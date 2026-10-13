# Design

## Context

Налични са (вж. proposal.md — Why): трите outbound порта `AccountRepository`
(`findByHouseholdId → Promise<readonly Account[]>`), `FeeScheduleRepository`
(`findById → Promise<FeeSchedule | undefined>`), `FeeReportPublisher`
(`publish → Promise<void>`); use case-ът `CalculateHouseholdFeesService`,
който ги оркестрира; и `test/architecture.test.ts`, който вече enforce-ва
таблицата: `adapters/out → domain, application, external`. Важно следствие:
**два файла в `adapters/out/` не могат да се импортират взаимно** (таблицата
няма `adapters/out → adapters/out`; коментарът в теста го казва изрично —
„anything two adapters share belongs in domain/ or behind a port“).

Backlog-ът фиксира: in-memory получават данните от конструктора (филтър по
`householdId`; `Map` по `id`); json четат `data/*.json` при всяка заявка с
`readFile` + `JSON.parse` + минимална проверка; publisher пише един ред на
stderr с точния формат от SUB-1.6.3.1. STORY-1.8 ще подава данни, път и
`STORAGE`; STORY-1.7 ще ползва stdout за CLI изхода, затова stderr тук.

Фикстурата `acc-1..acc-4`, `standard`, `premium` е вече в
`test/calculate-fees.test.ts` (STORY-1.4 D6 допусна, че STORY-1.6 може да я
смени, стига тоталът на `hh-1` да е 14 239.73) — тук я приемаме буквално като
съдържание на `data/*.json`.

## Goals / Non-Goals

**Goals:**
- Пет малки класа, всеки `implements` своя порт — учебният момент е, че
  `tsc` гърми в адаптера, ако портът се промени.
- Един contract тест, изпълнен срещу memory и json, който доказва
  критерия „еднакъв резултат за същите данни“ без да дублира assertion-ите.
- Конструктори, които STORY-1.8 може да извика на един ред всеки.

**Non-Goals:**
- Генерична `JsonFileRepository<T>` или общ `readJsonArray` модул — виж D4.
- Схема/валидация отвъд типа на полетата; бизнес валидност остава на domain.
- Кеш, file watching, запис.

## Decisions

### D1. Пет файла в `src/adapters/out/`, по един клас, без index

```
src/adapters/out/
  InMemoryAccountRepository.ts       class InMemoryAccountRepository implements AccountRepository
  InMemoryFeeScheduleRepository.ts   class InMemoryFeeScheduleRepository implements FeeScheduleRepository
  JsonFileAccountRepository.ts       class JsonFileAccountRepository implements AccountRepository
  JsonFileFeeScheduleRepository.ts   class JsonFileFeeScheduleRepository implements FeeScheduleRepository
  ConsoleFeeReportPublisher.ts       class ConsoleFeeReportPublisher implements FeeReportPublisher
data/
  accounts.json
  fee-schedules.json
```

- Плоска папка, един клас на файл, име = технология + порт. Пътят
  `adapters/out/` + префиксът казват „driven адаптер за X“ от пръв поглед;
  подпапки `memory/`, `json/` (както backlog-ът споменава `adapters/in/mcp`
  за EPIC-2) са възможни, но пет файла не ги оправдават.
- Без `index.ts`/barrel: `compose.ts` ще импортира всеки адаптер по име, което
  е част от урока „само bootstrap вижда конкретните адаптери“.
- Класове с `implements`, не фабрични функции — същото решение като STORY-1.4
  D1 и обещано в STORY-1.3 D2.

### D2. In-memory: копие на входа, `Map` за тарифите

```ts
export class InMemoryAccountRepository implements AccountRepository {
  private readonly accounts: readonly Account[];
  constructor(accounts: readonly Account[]) { this.accounts = [...accounts]; }
  async findByHouseholdId(householdId: string): Promise<readonly Account[]> {
    return this.accounts.filter((a) => a.householdId === householdId);
  }
}
export class InMemoryFeeScheduleRepository implements FeeScheduleRepository {
  private readonly byId: ReadonlyMap<string, FeeSchedule>;
  constructor(schedules: readonly FeeSchedule[]) {
    this.byId = new Map(schedules.map((s) => [s.id, s]));
  }
  async findById(id: string): Promise<FeeSchedule | undefined> { return this.byId.get(id); }
}
```

- `[...accounts]` в конструктора: извикващият може после да мутира своя масив
  (seed.ts, тестове), репозиторият не трябва да го усети. `filter` и без това
  връща нов масив, така че резултатът също не е вътрешното състояние. *Уточнение
  при apply:* spec-ът първоначално казваше „не мутира входа“; тестът проверява
  по-силното и по-полезното — изолация в двете посоки (извикващият мутира и
  входа, и резултата, репозиторият отговаря същото) — и spec-ът е преформулиран
  така.
- `Map` от `schedules.map(...)`: при дублиран `id` последният печели — така
  работи `new Map(entries)`; записано в spec, за да не е случайно.
- `async` методи върху синхронен код: портът е `Promise` (STORY-1.3 D5);
  `async` е най-краткият начин да се изпълни договорът и да се вижда в
  сигнатурата.

### D3. JSON-file: път в конструктора, четене при всяко извикване, guard по полета

```ts
export class JsonFileAccountRepository implements AccountRepository {
  constructor(private readonly filePath: string) {}
  async findByHouseholdId(householdId: string): Promise<readonly Account[]> {
    const accounts = await this.readAll();
    return accounts.filter((a) => a.householdId === householdId);
  }
  private async readAll(): Promise<Account[]> { /* readFile → JSON.parse → guard */ }
}
```

- `filePath: string` (абсолютен или относителен към cwd — решава извикващият;
  STORY-1.8 ще го сглоби от `import.meta.url`/`DATA_DIR`). Не `URL`, за да е
  тривиално да се подаде от env променлива. Тестовете ползват
  `fileURLToPath(new URL("../data/accounts.json", import.meta.url))`.
- Четене при **всяко** извикване (`node:fs/promises` `readFile`): без кеш по
  backlog. Учебната полза: редактираш `data/accounts.json`, пускаш CLI пак,
  виждаш промяната. Цената (едно четене на малък файл на заявка) е нищожна.
- Guard: `JSON.parse` → `Array.isArray` → за всеки елемент проверка на типа
  на всяко поле (`typeof x.id === "string"`, `typeof x.aum === "number"`, за
  тарифи `Array.isArray(tiers)` и `upTo === null || typeof upTo === "number"`).
  При проблем: `throw new Error(\`${filePath}: <причина>\`)` — причината
  назовава индекса и полето (`accounts[0].aum must be a number`). Обикновен
  `Error`, не `DomainError`: лош файл е инфраструктурна грешка; STORY-1.7 ще
  я преведе в 500 / exit 1 именно защото *не* е domain грешка (STORY-1.4 D5
  вече го предвиди: „инфраструктурни грешки … се пропускат както са“).
  Грешките от `readFile` (ENOENT и др.) и от `JSON.parse` се обвиват в нов
  `Error` с пътя в съобщението и оригинала като `cause`. *Уточнение при
  apply:* `cause` е добавено, за да не се губи оригиналният stack/код
  (напр. `ENOENT`) при превод в STORY-1.7.
- Guard-ът е **структурен** (типове на полета), не бизнес (`validateFeeSchedule`).
  Невалидни нива ще гръмнат с `InvalidFeeSchedule` от `feeForPeriod` — това е
  domain грешка с domain източник, както в STORY-1.2.

### D4. Дублиране на `readJson` guard-а вместо общ модул

Двата JSON адаптера имат ~15 еднакви реда (`readFile` + `JSON.parse` +
„очаква се масив“ + обвиване на грешката с пътя). Три възможности:

1. Общ `src/adapters/out/jsonFile.ts` — **забранено** от правилото за
   слоевете (`adapters/out → adapters/out` не е в таблицата) и арх тестът ще
   падне.
2. Да се разшири таблицата с `adapters/out → adapters/out` — променя spec
   `architecture-dependency-rule` и отслабва правилото „адаптерите не се
   познават“, което е самата поанта на STORY-1.5. Отхвърлено.
3. **Дублиране** в двата файла с коментар, който обяснява защо. Избрано:
   15 реда са по-евтини от размиването на правилото, и дублирането *е*
   урокът — ако расте, следващата стъпка е порт/домейн тип, не споделен
   helper между адаптери.

### D5. Publisher: `write`-sink в конструктора, `process.stderr` по подразбиране

```ts
type LineSink = { write(chunk: string): unknown };
export class ConsoleFeeReportPublisher implements FeeReportPublisher {
  constructor(private readonly sink: LineSink = process.stderr) {}
  async publish(report: FeeReport): Promise<void> {
    const n = report.lines.length;
    this.sink.write(
      `[publish] household ${report.householdId} ${report.period.from}..${report.period.to} ` +
      `total=${report.total} (${n} ${n === 1 ? "account" : "accounts"})\n`,
    );
  }
}
```

- Най-малкият структурен тип, който `process.stderr` удовлетворява
  (`write(chunk)`), вместо `NodeJS.WritableStream`: тестът подава
  `{ write: (s) => lines.push(s) }`, без stream-ове. `unknown` като връщан тип,
  защото `WriteStream.write` връща `boolean`, а fake-ът — `number` от `push`.
- `process.stderr` по подразбиране, за да е `new ConsoleFeeReportPublisher()`
  на един ред в `compose.ts`; `node:process` не се импортира — глобалният
  `process` стига, а `adapters/out` и без това има право на `external`.
- `report.total` се интерполира директно: `14239.73` → `"14239.73"`, без
  `toFixed(2)` (който би дал `"9000.00"` за цели суми и би въвел втори
  формат за пари). Форматът от backlog-а показва числото както е.
- Не се изчаква drain/`"finish"`: `publish` resolve-ва щом редът е подаден —
  достатъчно за конзола и съответства на spec-а „след като редът е подаден“.

### D6. Примерни данни: буквално фикстурата от `calculate-fees.test.ts`

`data/accounts.json` — масив с `acc-1` Alpha 2 500 000 standard hh-1,
`acc-2` Beta 150 000 standard hh-1, `acc-3` Gamma 4 000 000 premium hh-1,
`acc-4` Delta 800 000 standard hh-2. `data/fee-schedules.json` — `standard`
(1M@100, 5M@75, null@50; мин. 2 500) и `premium` (null@85; мин. 5 000).
Без обвиващ обект (`{ "accounts": [...] }`): едно към едно с domain типа
значи, че `JSON.parse` + guard е целият „ORM“. Форматирано с 2 интервала,
за да е четимо в README.

### D7. Тест: `test/out-adapters.test.ts` с contract функция + temp файлове

- `describe("in-memory-repositories")`, `describe("json-file-repositories")`,
  `describe("console-report-publisher")` — по един на spec, по `test` на
  scenario.
- Contract: `function repositoryContract(name, make: () => { accounts: AccountRepository; schedules: FeeScheduleRepository })`
  регистрира общите тестове (hh-1 → три id-та; hh-404 → `[]`; `standard` →
  deepEqual; `vip` → `undefined`). Извиква се веднъж с memory върху
  фикстурата и веднъж с json върху `data/*.json`. Разликата в реда
  (`acc-3, acc-1, acc-2` за memory спрямо `acc-1, acc-2, acc-3` във файла) се
  избягва, като contract-ът сравнява сортирани id-та, а редът „както е
  подаден“ се тества отделно в memory секцията.
- End-to-end равенство: `CalculateHouseholdFeesService(memAcc, memSch, spy)`
  и `CalculateHouseholdFeesService(jsonAcc, jsonSch, spy)` → `assert.deepEqual`
  на двата отчета и `total === 14239.73`. Това е буквално критерият на
  story-то.
- Лоши файлове: `mkdtemp` в `os.tmpdir()`, `writeFile`, `assert.rejects` с
  predicate върху `message` (съдържа пътя / `aum` / „array“). `after` чисти
  с `rm(dir, { recursive: true })`.
- Publisher: fake sink → точният низ; `mock.method(process.stderr, "write", () => true)`
  + същото за `stdout` (от `node:test`) за сценариите „по подразбиране
  stderr“ и „заменен поток не докосва process“. Mock-ът не извиква оригинала
  (иначе цапа изхода на теста) и се възстановява в `finally` веднага след
  assert-ите, не в `after`, за да е прозорецът без TAP изход минимален.
- Тестовете могат да ползват `node:fs`, `node:os`, `node:path` — правилото за
  слоевете важи за `src/`.

### D8. Проверка на зависимостите

`npm test` → `architecture.test.ts` вече проверява реалните import-и:
очаквани са само `../../application/ports/out/*.ts` (`import type`),
`../../domain/*.ts` (`import type`) и `node:fs/promises`. Ако guard-ът в D4
бъде „оптимизиран“ в общ файл, тестът го хваща.

## Risks / Trade-offs

- [Дублиран `readJson` код в два адаптера] → D4: умишлено; коментар сочи
  правилото за слоевете. Ако EPIC-2 (SQLite) добави трети адаптер с нужда от
  общ код, тогава се обсъжда domain-ниво помощник или порт.
- [`typeof` guard-ът пропуска допълнителни полета в JSON] → приема се:
  допълнителни полета са безвредни (TypeScript structural typing); липсващи
  и грешно типизирани се хващат. Spec-ът изисква само второто.
- [Mock на `process.stdout.write` може да погълне TAP изхода на runner-а по
  време на теста] → mock-ът живее само в един кратък `test` и се
  възстановява веднага след assert-а (не в `after`); `node:test` пише
  резултата на теста след края му. Ако при apply се окаже, че изходът се
  губи, се моква само `stderr.write`, а чистият stdout се доказва структурно:
  класът никога не реферира `process.stdout`.
- [`report.total` като `${number}` дава `1e+21` за абсурдни суми] → извън
  реалистичния диапазон; не се третира.
- [Четене на файл при всяка заявка под HTTP натоварване] → учебен проект;
  non-goal; упражнение за кеш е възможно в README.
- [Относителен `filePath` зависи от cwd] → STORY-1.8 подава абсолютен път от
  `import.meta.url`; тук тестовете също подават абсолютен.
