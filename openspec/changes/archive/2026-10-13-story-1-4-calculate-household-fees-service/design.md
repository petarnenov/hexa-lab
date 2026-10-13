# Design

## Context

Налични са (вж. proposal.md — Why): domain функциите `createBillingPeriod`,
`feeForPeriod`, `buildFeeReport` и грешките `InvalidBillingPeriod`,
`HouseholdNotFound`, `FeeScheduleNotFound`; портовете `CalculateHouseholdFees`
(in) и `AccountRepository`, `FeeScheduleRepository`, `FeeReportPublisher`
(out), всичките `Promise`-базирани. Репозиториите връщат „няма“ (празен масив
/ `undefined`), а не хвърлят — решението, че това е грешка, е изрично оставено
за use case-а (STORY-1.3, D4).

Ограничения: `application/` импортира само `domain/` и `application/`
(`openspec/config.yaml`); няма `architecture.test.ts` още (STORY-1.5), затова
правилото се пази ръчно + guard тест. Тест преди код, `node:test`, без
runtime зависимости.

Backlog-ът фиксира потока: период → сметки → тарифи (по веднъж на id) →
редове сортирани по `accountId` → отчет → publish → return; и грешките:
празен household → `HouseholdNotFound`, липсваща тарифа → `FeeScheduleNotFound`.

## Goals / Non-Goals

**Goals:**
- Един клас, един публичен метод, нула инфраструктура — четим от обучаващ се
  отгоре надолу като списък от стъпки.
- Всеки ред от потока има тест, който го фиксира (включително „тарифа веднъж
  на id“ и „publish точно веднъж“), така че бъдещи адаптери да не могат да
  променят поведението незабелязано.
- Конструкторът е договорът за `compose.ts` (STORY-1.8).

**Non-Goals:**
- Производителност (паралелно зареждане на тарифи, кеш между извиквания).
- `Result`/`Either` вместо изключения; `DomainError` вече е избран (STORY-1.2).
- Валидиране на тарифите в use case-а — `feeForPeriod` вече вика
  `validateFeeSchedule`, `InvalidFeeSchedule` просто се пропуска нагоре.
- Защита от дублирани `accountId` в хранилището — отговорност на адаптера.

## Decisions

### D1. Разположение и форма: клас в `src/application/CalculateHouseholdFeesService.ts`

```
src/application/
  CalculateHouseholdFeesService.ts   class CalculateHouseholdFeesService
  ports/in|out/...                   (STORY-1.3, без промяна)
```

- Класът стои до `ports/`, не в него: портовете са договори, сервизът е
  имплементация на един от тях. Суфиксът `Service` следва backlog-а и
  различава имплементацията от интерфейса `CalculateHouseholdFees`.
- `class ... implements CalculateHouseholdFees` вместо фабрична функция:
  `implements` дава грешка на мястото на класа при разминаване с порта — това
  е точно урокът „портът е договор“. Алтернатива: `function
  createCalculateHouseholdFees(deps): CalculateHouseholdFees` — еднакво чиста,
  но скрива `implements`; отхвърлена заради учебната цел.

### D2. Конструктор с три позиционни порта

```ts
constructor(
  private readonly accounts: AccountRepository,
  private readonly schedules: FeeScheduleRepository,
  private readonly publisher: FeeReportPublisher,
) {}
```

- Имената `accounts`, `schedules`, `publisher` са от backlog-а (SUB-1.4.1.1).
  Параметърните свойства (`private readonly` в сигнатурата) са най-късият
  начин да се покаже ръчно DI без контейнер.
- Позиционни, не обект `{ accounts, schedules, publisher }`: три параметъра с
  различни типове не се объркват, а `compose.ts` ще ги подава на един ред.
  Ако STORY-2.3 добави `Clock`, тогава се мисли за обект.
- Всички `import`-и на портове и domain типове са `import type`; единствените
  value import-и са `createBillingPeriod`, `feeForPeriod`, `buildFeeReport` и
  двете грешки от `domain/`.

### D3. `execute` — линеен поток, fail-fast преди I/O

```ts
async execute(command) {
  const period = createBillingPeriod(command.from, command.to);   // 1. може да хвърли InvalidBillingPeriod
  const accounts = await this.accounts.findByHouseholdId(command.householdId);
  if (accounts.length === 0) throw new HouseholdNotFound(command.householdId);  // 2.
  const schedules = await this.loadSchedules(accounts);            // 3. Map<id, FeeSchedule>, веднъж на id
  const lines = [...accounts]
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))     // 4. копие, не мутира входа
    .map((account) => toLine(account, schedules.get(account.feeScheduleId)!, period));
  const report = buildFeeReport(command.householdId, period, lines); // 5.
  await this.publisher.publish(report);                             // 6. точно веднъж
  return report;                                                    // 7. същият обект
}
```

- Периодът се валидира **преди** първото `await`, за да няма I/O при
  невалиден вход (spec: „Периодът се валидира преди всяко I/O“). Грешката е
  синхронна в тялото на `async` функция, затова извикващият пак я получава
  като отхвърлен `Promise` — един и същ канал за всички грешки.
- `createBillingPeriod` хвърля с `label` `from`/`to`, което адаптерите после
  показват; use case-ът не го преопакова.
- Сортирането е по `accountId` с обикновено сравнение на низове (не
  `localeCompare`): детерминирано, без зависимост от locale на процеса.
  `[...accounts]` защото портът връща `readonly Account[]` и `sort` мутира.
- `toLine` е малка private/module функция: `{ accountId, accountName, aum,
  feeScheduleId, fee: feeForPeriod(aum, schedule, period) }`. Държи `execute`
  на едно ниво на абстракция.

### D4. Тарифите се зареждат последователно, веднъж на id, в ред на срещане

```ts
private async loadSchedules(accounts) {
  const byId = new Map<string, FeeSchedule>();
  for (const { feeScheduleId } of accounts) {
    if (byId.has(feeScheduleId)) continue;
    const schedule = await this.schedules.findById(feeScheduleId);
    if (schedule === undefined) throw new FeeScheduleNotFound(feeScheduleId);
    byId.set(feeScheduleId, schedule);
  }
  return byId;
}
```

- `Map` + `has` е буквалното „по веднъж на id“ от backlog-а и се тества със
  spy, който брои извикванията.
- Последователно (`for … await`) вместо `Promise.all` върху уникалните id-та:
  при две липсващи тарифи грешката е детерминирано първата срещната; кодът
  се чете като изречение. Цената е N последователни `await` при N тарифи —
  N е 2 в този проект. Алтернативата `Promise.all` се споменава в коментар
  като упражнение, не се прилага.
- Редът на срещане е редът от хранилището (преди сортирането на редовете) —
  spec-ът изисква само „веднъж на id“, не ред на заявките.

### D5. Грешките не се обвиват; publish е последната стъпка

- `HouseholdNotFound` и `FeeScheduleNotFound` се вдигат директно от
  `domain/errors.ts` (те са дефинирани там точно за това — spec
  `domain-errors`). `InvalidBillingPeriod` и `InvalidFeeSchedule` идват от
  domain функциите непроменени. Инфраструктурни грешки от репозиториите
  (напр. нечетим файл в STORY-1.6) се пропускат както са — use case-ът не
  знае какво са и не трябва да ги прикрива като domain грешки.
- `publish` е след `buildFeeReport` и преди `return`, така че всяка грешка
  по-рано гарантирано означава „нищо не е публикувано“ (тестът проверява
  `published.length === 0` при всеки failure кейс). Грешка от самия
  `publish` се пропуска нагоре, отчетът не се връща — half-success няма.
- `try/catch` в сервиза няма: нищо не се превежда тук; преводът е работа на
  driving адаптерите (STORY-1.7).

### D6. Тестът: fake-ове от `ports.test.ts` + spy-ове с броячи

`test/calculate-fees.test.ts`, `describe("calculate-household-fees")`, по
един `test` на spec scenario:

- Fixture: `standard` (както в `domain.test.ts`: 100/75/50 bps, минимум
  2 500) и `premium` (едно ниво `upTo: null`, 85 bps, минимум 5 000);
  сметки `acc-1` 2 500 000 `standard`, `acc-2` 150 000 `standard`, `acc-3`
  4 000 000 `premium`, всички в `hh-1`; `acc-4` в `hh-2`. Q1 2026 → 5 239.73
  + 616.44 + 8 383.56 = **14 239.73** (числото от EPIC-1).
  *Допускане:* блупринтът не е в репото; `premium` тук е измислен така, че
  тоталът да е 14 239.73. STORY-1.6 може да сложи друг `premium` в
  `data/*.json`, стига тоталът на `hh-1` да остане същият — тестът на use
  case-а не зависи от seed данните.
- Хранилищата са малки фабрики `accountRepo(accounts)`,
  `scheduleRepo(schedules)` → `{ repo, calls: string[] }`; spy publisher →
  `{ publisher, published: FeeReport[] }`. Броячите правят проверими „веднъж
  на id“ и „не е извикан при грешка“. *Уточнение при apply:* fake-ът и
  броячът са отделни полета (не един обект с допълнително поле `calls`), за
  да остане `repo` точно от типа на порта без излишни членове; помощник
  `setup({ accounts?, schedules? })` сглобява сервиза върху фикстурата, за да
  не повтаря всеки тест трите реда DI.
- Сортиране: същите сметки, подадени в ред `acc-3, acc-1, acc-2`.
- Guard „без инфраструктура“: чете `src/application/CalculateHouseholdFeesService.ts`
  с `node:fs/promises` и проверява `/adapters\/|bootstrap\/|node:|process\.env|console\./`
  да няма съвпадения — същият евтин подход като в `ports.test.ts`.
- Грешките с идентификатор се проверяват с predicate към `assert.rejects`:
  `(err) => err instanceof HouseholdNotFound && err.householdId === "hh-404"`;
  тези без — с класа директно (`assert.rejects(p, InvalidBillingPeriod)`).

### D7. Ръчна проверка на зависимостите

`grep -rn 'from "' src/application` трябва да показва само `./ports/…` и
`../domain/…`. `npm run typecheck` покрива `test/` (вж. `tsconfig.json`).

## Risks / Trade-offs

- [Сортирането по `accountId` като низ дава `acc-10` преди `acc-2`] → приема
  се: id-тата са непрозрачни низове, не числа; документирано в коментар. Ако
  трябва естествено сортиране, то е промяна на spec-а, не на кода.
- [`schedules.get(account.feeScheduleId)!` с non-null assertion] → всяко id е гарантирано
  в `Map`-а от D4 (иначе е хвърлено). Коментар обяснява защо `!` е безопасен
  тук; алтернатива е `?? throw`, което би било мъртъв код.
- [Guard тестът с regex може да хване думата в коментар] → коментарите в
  сервиза говорят за „портове“ и „адаптери“ като понятие без `/`;
  `adapters/` с наклонена черта се появява само в import път.
- [Последователното зареждане е по-бавно от `Promise.all`] → N ≤ 2 тарифи;
  приоритет е детерминизъм и четимост (D4).
- [Тестовете дублират fixture от `ports.test.ts` и `domain.test.ts`] →
  съзнателно: всеки тестов файл е самостоятелно четим; общ `test/fixtures.ts`
  е възможно упражнение, но STORY-1.5 ще реши дали си заслужава.
