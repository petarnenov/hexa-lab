# Proposal

## Why

Domain слоят (STORY-1.2) смята такси, но нищо не казва как приложението получава
сметки и тарифи и къде праща отчета. Портовете са границата на хексагона: без
тях use case-ът (STORY-1.4) и адаптерите (STORY-1.6, 1.7) няма срещу какво да се
пишат. Те трябва да са преди use case-а, за да може той да се тества с fake
имплементации още от първия ред.

## What Changes

- Нова папка `src/application/ports/` с четири файла, само `interface`/`type`,
  без нито ред изпълним код:
  - `in/CalculateHouseholdFees.ts` — driving порт: `execute({ householdId, from, to })`
    връща `Promise<FeeReport>`. Периодът влиза като сурови низове, защото
    адаптерите не трябва да знаят как се валидира дата.
  - `out/AccountRepository.ts` — `findByHouseholdId(householdId): Promise<readonly Account[]>`.
  - `out/FeeScheduleRepository.ts` — `findById(id): Promise<FeeSchedule | undefined>`.
  - `out/FeeReportPublisher.ts` — `publish(report): Promise<void>`.
- Нов `test/ports.test.ts`, който доказва двете свойства от критериите на
  story-то: (а) всеки порт се имплементира от минимален fake без помощни
  средства; (б) модулите на портовете нямат runtime export-и — при `import`
  са празни обекти. Тестът е и първият консуматор на портовете, с който
  STORY-1.4 ще започне.
- Outbound портовете говорят само с domain типове (`Account`, `FeeSchedule`,
  `FeeReport`) и `Promise` — никакви имена на технологии (file, json, sql,
  console) в типове, методи или параметри.

## Покрити backlog елементи

- STORY-1.3 Портове in/out
  - TASK-1.3.1 Inbound порт
    - SUB-1.3.1.1 CalculateHouseholdFees.ts
  - TASK-1.3.2 Outbound портове
    - SUB-1.3.2.1 AccountRepository.ts
    - SUB-1.3.2.2 FeeScheduleRepository.ts
    - SUB-1.3.2.3 FeeReportPublisher.ts

## Capabilities

### New Capabilities

- `calculate-household-fees`: договорът на use case-а „изчисли таксите на
  household“ към външния свят — какво получава (command), какво връща и че е
  асинхронен. STORY-1.4 ще добави в същата capability поведението на
  изпълнението (поток, грешки).
- `outbound-ports`: нуждите на приложението към външния свят — откъде идват
  сметки и тарифи и къде отива отчетът — изразени в domain термини, без
  технология.

### Modified Capabilities

(няма)

## Non-goals

- Няма имплементации на портовете — `CalculateHouseholdFeesService` е
  STORY-1.4, in-memory/json/console адаптерите са STORY-1.6.
- Няма `architecture.test.ts` — STORY-1.5. Правилото „application импортира
  само domain/ и application/“ се проверява ръчно с `grep` в този change.
- Няма порт `Clock` (STORY-2.3) и няма `PreviewHouseholdFees` (STORY-2.4).
- Няма валидация във портовете — те са типове; валидирането на периода е
  работа на use case-а чрез `createBillingPeriod`.
- Няма barrel `ports/index.ts` — консуматорите импортират конкретния файл, за
  да вижда бъдещият архитектурен тест реалните зависимости.

## Impact

- Нови файлове: `src/application/ports/in/CalculateHouseholdFees.ts`,
  `src/application/ports/out/AccountRepository.ts`,
  `src/application/ports/out/FeeScheduleRepository.ts`,
  `src/application/ports/out/FeeReportPublisher.ts`, `test/ports.test.ts`.
- Без промени по domain, `package.json`, `tsconfig.json`, зависимости.
- Сигнатурите стават договор за STORY-1.4 (имплементира inbound, консумира
  outbound), STORY-1.6 (имплементира outbound) и STORY-1.7 (консумира inbound).
