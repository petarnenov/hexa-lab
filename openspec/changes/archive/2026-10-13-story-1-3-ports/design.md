# Design

## Context

`src/domain/` е готов и чист (вж. proposal.md — Why). Следващият слой навън е
`application/`, който по `openspec/config.yaml` импортира само `domain/` и
`application/`. Backlog-ът фиксира имената на файловете и сигнатурите:
`execute(cmd: { householdId, from, to }): Promise<FeeReport>`,
`findByHouseholdId(id): Promise<readonly Account[]>`, `findById(id): Promise<FeeSchedule | undefined>`,
`publish(report): Promise<void>`. STORY-1.4 описва как ще ги ползва: ръчно DI
с `accounts`, `schedules`, `publisher`; празен household → `HouseholdNotFound`;
липсваща тарифа → `FeeScheduleNotFound`. Това предопределя, че репозиториите
връщат „няма“ (празен масив / `undefined`), а не хвърлят.

Няма `architecture.test.ts` (STORY-1.5), така че правилото за зависимостите
се пази ръчно, както в STORY-1.2.

## Goals / Non-Goals

**Goals:**
- Четири файла, всеки по един `interface`, с коментар защо портът съществува
  и кой го имплементира / консумира.
- Сигнатури, които STORY-1.4, 1.6 и 1.7 ползват без промяна.
- Тест, който проверява точно свойствата „само тип“ и „имплементируем от fake“,
  без да предполага имплементация.

**Non-Goals:**
- Generic `Repository<T>` абстракция — три конкретни интерфейса са по-ясни
  за обучаващ се и не водят към ORM мислене.
- Branded ID типове, `Result`/`Either` вместо `Promise` + изключения.
- `Clock` порт и `preview` use case — EPIC-2.

## Decisions

### D1. Разположение: `src/application/ports/in|out/`

```
src/application/ports/
  in/CalculateHouseholdFees.ts     interface CalculateHouseholdFees
                                   type CalculateHouseholdFeesCommand
  out/AccountRepository.ts         interface AccountRepository
  out/FeeScheduleRepository.ts     interface FeeScheduleRepository
  out/FeeReportPublisher.ts        interface FeeReportPublisher
```

- Папката `ports/` с подпапки `in/` и `out/` прави посоката видима от пътя
  — това е учебната цел на story-то. STORY-1.4 слага сервиза в
  `src/application/CalculateHouseholdFeesService.ts` (до портовете, не в тях).
- Алтернатива: плоско `src/application/*.ts`. Отхвърлена — губи се
  разграничението driving/driven, което адаптерите после огледално повтарят
  в `adapters/in|out`.

### D2. `interface`, не `type`

Domain типовете са `type` (данни без поведение, D1 в STORY-1.2). Портовете са
обратното — поведение без данни, което някой *имплементира*. `interface` казва
точно това и позволява `class X implements AccountRepository` в STORY-1.6, с
грешка на мястото на класа, а не на мястото на употребата. Контрастът
`type` за данни / `interface` за портове е умишлен и се обяснява в коментар.

### D3. Командата е отделен `type` със сурови низове

```ts
export type CalculateHouseholdFeesCommand = {
  readonly householdId: string;
  readonly from: string;   // YYYY-MM-DD, validated by the use case
  readonly to: string;
};
export interface CalculateHouseholdFees {
  execute(command: CalculateHouseholdFeesCommand): Promise<FeeReport>;
}
```

- Низове вместо `BillingPeriod`: ако портът искаше `BillingPeriod`, всеки
  адаптер трябваше да вика `createBillingPeriod` и да превежда
  `InvalidBillingPeriod` сам — валидацията щеше да се размножи по адаптерите.
  С низове use case-ът валидира веднъж, а адаптерите само превеждат грешката
  (STORY-1.7). Това е и буквалната сигнатура от backlog-а.
- Командата е именуван тип (не inline), за да могат адаптерите и тестовете да я
  импортират и да си строят фикстури.
- Резултатът е domain `FeeReport` директно, без DTO — CLI и HTTP форматират
  от един и същ обект (spec `fee-report`).

### D4. Репозиториите връщат „няма“, не хвърлят

`findByHouseholdId → readonly Account[]` (празен при непознат household),
`findById → FeeSchedule | undefined`. Репозиторият не знае дали липсата е
грешка — в бъдещ `preview` use case празен household може да е валиден. Use
case-ът (STORY-1.4) превръща празния списък в `HouseholdNotFound`, а
`undefined` в `FeeScheduleNotFound`. Така domain грешките остават с един
източник. Алтернатива: репозиторият хвърля; отхвърлена — размива бизнес
решението в инфраструктурата.

*Уточнение при apply:* backlog-ът пише `Account[]`, но портът връща
`readonly Account[]` — use case-ът само чете списъка, а адаптерът може да
върне вътрешния си масив, без някой да го мутира отвън.

### D5. Всичко е `Promise`, включително in-memory

`InMemory*` (STORY-1.6) е синхронен по природа, но портът е `Promise`, защото
JSON файл и бъдещ SQLite (STORY-2.1) са асинхронни. Портът описва най-общата
нужда; иначе смяната на адаптер щеше да сменя сигнатурата. Цената е `await`
навсякъде в use case-а — приемлива.

### D6. Тестът проверява типовете чрез `satisfies` и празни модули

`test/ports.test.ts`:
- Fake имплементации като обектни литерали, анотирани с типа на порта
  (`const fake: AccountRepository = {...}`) — ако портът добави член или смени
  сигнатура, `npm run typecheck` (който включва `test/`) гърми тук. Същите
  fakes в STORY-1.4 се местят/копират в `test/calculate-fees.test.ts`.
  *Отклонение при apply:* планът беше `satisfies <Port>`, но `satisfies`
  запазва literal типа `() => Promise<...>` на fake-а и извикването
  `execute(command)` дава TS2554; анотацията проверява същата форма без
  този страничен ефект.
- По един `test` на spec scenario: `findByHouseholdId` с две/нула сметки,
  `findById` с/без тарифа, `publish` записва и връща `undefined`, inbound fake
  връща отчет.
- „Само тип“: `const mod = await import("../src/application/ports/out/AccountRepository.ts"); assert.deepEqual(Object.keys(mod), [])`
  за всеки от четирите файла. `verbatimModuleSyntax` + `import type` гарантират,
  че импортът не оставя следа и в консуматорите.
- „Без технологични думи“: тестът чете трите outbound файла с `node:fs` и
  проверява `/file|json|sql|console|http/i` да няма съвпадения — евтин guard
  срещу `JsonAccountRepository`-подобни изкушения. (Тестовете могат да ползват
  `node:`; правилото за слоевете важи за `src/`.)

### D7. Ръчна проверка на зависимостите

`grep -rn 'from "' src/application` трябва да показва само `../../../domain/*.ts`
(с `import type`). STORY-1.5 ще го автоматизира.

## Risks / Trade-offs

- [Сурови низове в командата позволяват невалиден вход да стигне до use
  case-а] → именно там се валидира с `createBillingPeriod`; spec
  `billing-period` вече фиксира грешките.
- [Анотацията с типа на порта тества само формата, не че някой наистина имплементира порта] →
  STORY-1.4/1.6 носят истинските имплементации; тук целта е „имплементируем от
  минимален fake“.
- [Regex за технологични думи може да даде фалшив позитив в коментар] →
  коментарите в портовете описват нуждата, не технологията; ако трябва да се
  спомене „file“, пише се в design/README, не в порта. *Случи се при apply:*
  „touches this file“ в коментар на `AccountRepository.ts` → „this port“.
- [Без `architecture.test.ts` правилото за слоевете не е enforce-нато] → D7
  ръчно; STORY-1.5.
