# Proposal

## Why

Domain слоят смята такси (STORY-1.2), портовете описват откъде идват данните и
къде отива отчетът (STORY-1.3), но никой не ги свързва: няма код, който да
вземе household, период и тарифи и да върне отчет. Use case-ът е сърцето на
хексагона — единственото място, където портовете се оркестрират — и трябва да
съществува преди адаптерите (STORY-1.6, 1.7), за да се докаже, че цялата
бизнес логика се тества само с fake-ове в паметта.

## What Changes

- Нов `src/application/CalculateHouseholdFeesService.ts` — клас, който
  имплементира inbound порта `CalculateHouseholdFees` и получава трите
  outbound порта през конструктора (ръчно DI: `accounts`, `schedules`,
  `publisher`).
- Поток на `execute`: валидира периода (`createBillingPeriod`) → взима
  сметките на household-а → зарежда всяка тарифа **по веднъж на id** → строи
  редове, **сортирани по `accountId`**, с `feeForPeriod` → `buildFeeReport` →
  `publish` точно веднъж → връща същия отчет.
- Грешки на use case-а: празен списък сметки → `HouseholdNotFound`; тарифа,
  която репозиторият не намира → `FeeScheduleNotFound`; невалидни дати →
  `InvalidBillingPeriod` от domain-а, преди каквото и да е I/O. При грешка
  отчет не се публикува.
- Нов `test/calculate-fees.test.ts` с in-memory fake-ове и spy publisher:
  успешен път (`hh-1`, Q1 2026 → 3 реда, `total = 14239.73`, publish веднъж
  със същия обект), трите грешки без publish, тарифа заредена веднъж на id,
  сортиране независимо от реда в хранилището, и guard, че сервизът не
  импортира адаптери, не чете `process.env` и не пише в `console`.
  STORY-1.5 (TASK-1.5.2) ще разшири същия файл, не го замества.

## Покрити backlog елементи

- STORY-1.4 Use case: изчисли таксите на household
  - TASK-1.4.1 CalculateHouseholdFeesService
    - SUB-1.4.1.1 Конструктор с портове
    - SUB-1.4.1.2 Поток на execute
    - SUB-1.4.1.3 Грешки на use case-а

## Capabilities

### New Capabilities

(няма)

### Modified Capabilities

- `calculate-household-fees`: STORY-1.3 фиксира договора (команда, резултат,
  само тип). Този change **добавя** поведението на изпълнението — ред на
  стъпките, една тарифа на id, сортирани редове, публикуване точно веднъж,
  грешки без публикуване и изолация от инфраструктура. Съществуващите
  requirements не се променят (само ADDED).

## Non-goals

- Няма адаптери — in-memory/json/console са STORY-1.6; CLI/HTTP са STORY-1.7.
- Няма `architecture.test.ts` (STORY-1.5); правилото „application импортира
  само domain/ и application/“ се пази с `grep` и с guard теста в този change.
- Няма `bootstrap/compose.ts` (STORY-1.8) — сервизът се конструира само в
  тестовете.
- Няма пълното покритие от TASK-1.5.2; тук са кейсовете, нужни за test-first
  на самия сервиз. STORY-1.5 допълва.
- Няма `Clock` порт, `preview` use case, транзакции, retry, кеш на тарифите
  между извиквания.
- Няма промяна по domain, портове, `package.json`, `tsconfig.json`.

## Impact

- Нови файлове: `src/application/CalculateHouseholdFeesService.ts`,
  `test/calculate-fees.test.ts`.
- `src/application/` получава първия си изпълним модул; досега папката
  съдържаше само типове. Правилото за зависимостите (domain + application)
  важи с пълна сила.
- Сигнатурата на конструктора става договор за `bootstrap/compose.ts`
  (STORY-1.8). Поведението на грешките става договор за превода им в HTTP
  статуси и exit кодове (STORY-1.7).
