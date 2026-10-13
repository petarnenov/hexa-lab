# Tasks

## 1. TASK-1.4.1 CalculateHouseholdFeesService

- [x] 1.1 Сложи `status: in-progress` на `backlog/.../STORY-1.4.md` (само frontmatter); провери с `grep -rl '^status: in-progress' backlog`, че това е единственият елемент в работа.
- [x] 1.2 (SUB-1.4.1.1) Създай `test/calculate-fees.test.ts` с fixture по design.md D6 (`standard`, `premium`, `acc-1..acc-4`, Q1 2026), фабрики `accountRepo`/`scheduleRepo` с броячи на извикванията и spy publisher с `published: FeeReport[]`. Първи тест: `new CalculateHouseholdFeesService(accounts, schedules, publisher)` се присвоява на променлива от тип `CalculateHouseholdFees` и `execute` за `hh-1` връща отчет с `householdId = "hh-1"`. Провери, че `npm test` пада заради липсващия модул.
- [x] 1.3 (SUB-1.4.1.1) Създай `src/application/CalculateHouseholdFeesService.ts` по design.md D1/D2: `class CalculateHouseholdFeesService implements CalculateHouseholdFees` с конструктор `(accounts, schedules, publisher)` като `private readonly` параметърни свойства и минимален `execute`, който връща `buildFeeReport` с празни редове. Коментар в началото: защо клас + `implements`, защо ръчно DI. Провери, че тестът от 1.2 минава.
- [x] 1.4 (SUB-1.4.1.2) Добави тестовете за потока по spec: три реда `acc-1, acc-2, acc-3` с такси 5 239.73 / 616.44 / 8 383.56 и `total = 14239.73`; редове сортирани по `accountId` при хранилище, връщащо `acc-3, acc-1, acc-2`; `findById` извикан точно по веднъж за `standard` и `premium`; `publish` извикан точно веднъж и `published[0] === result` (същият обект). Провери, че падат.
- [x] 1.5 (SUB-1.4.1.2) Имплементирай пълния `execute` по design.md D3/D4: `createBillingPeriod` преди първото `await`, `findByHouseholdId`, `loadSchedules` с `Map` (веднъж на id, последователно), копие + `sort` по `id`, `toLine` с `feeForPeriod`, `buildFeeReport`, `await publish`, `return report`. Коментар на всяка стъпка от потока и защо `!` при `schedules.get` е безопасен. Провери, че тестовете от 1.4 минават.
- [x] 1.6 (SUB-1.4.1.3) Добави тестовете за грешки по spec: `hh-404` → `assert.rejects` с `HouseholdNotFound` и `householdId = "hh-404"`; сметка с `feeScheduleId: "vip"` → `FeeScheduleNotFound` с `feeScheduleId = "vip"`; `from = 2026-02-30` → `InvalidBillingPeriod` **и** нула извиквания към двете хранилища; `from > to` → `InvalidBillingPeriod`; publisher, който отхвърля → `execute` се отхвърля със същата грешка. Във всеки failure кейс `published.length === 0`. Провери кои падат (празен household и липсваща тарифа трябва да падат).
- [x] 1.7 (SUB-1.4.1.3) Добави в сервиза `throw new HouseholdNotFound(...)` при празен списък и `throw new FeeScheduleNotFound(...)` при `undefined` от хранилището (design.md D5), с коментар, че use case-ът — не репозиторият — решава, че липсата е грешка, и че `publish` е последната стъпка нарочно. Провери, че всички тестове от 1.6 минават.
- [x] 1.8 Добави guard тест „без инфраструктура“: прочети `src/application/CalculateHouseholdFeesService.ts` с `node:fs/promises` и провери, че `/adapters\/|bootstrap\/|node:|process\.env|console\./` няма съвпадение; при нужда преформулирай коментарите. Провери ръчно правилото за зависимостите (design.md D7): `grep -rn 'from "' src/application` показва само `./ports/…` и `../domain/…`.
- [x] 1.9 `npm run typecheck && npm test` минават.

## Workflow follow-up

- Sync docs: прегледай `design.md`, `proposal.md` и delta spec-а срещу реалния код и поправи отклоненията (с едно изречение *защо* в design.md); няма `README.md` още.
- `/opsx:archive story-1-4-calculate-household-fees-service` — мърджва delta-та в `openspec/specs/calculate-household-fees/` и сменя status на STORY-1.4, TASK-1.4.1 и SUB-1.4.1.x на `done`.
- `/commit`, после `/clear`.
