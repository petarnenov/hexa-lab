# Proposal

## Why

Use case-ът работи (STORY-1.4), но единствените имплементации на outbound
портовете са fake-овете в тестовете. Хексагонът доказва смисъла си едва когато
зад един и същ порт застанат две различни технологии и use case-ът дава един и
същ отчет без да забележи смяната. Driven адаптерите трябва да съществуват
преди composition root-а (STORY-1.8), който ще ги избира по `STORAGE`.

## What Changes

- Нови in-memory репозитории в `src/adapters/out/`: `InMemoryAccountRepository`
  (филтър по `householdId` върху масив от конструктора) и
  `InMemoryFeeScheduleRepository` (`Map` по `id`). Синхронни по природа, но
  изпълняват `Promise` договора на портовете.
- Нови JSON-file репозитории: `JsonFileAccountRepository` и
  `JsonFileFeeScheduleRepository` четат `data/accounts.json` /
  `data/fee-schedules.json` **при всяка заявка** (`readFile` + `JSON.parse` +
  минимална проверка на формата); нечетим или неправилно оформен файл дава
  грешка с пътя и причината, не `undefined`.
- Нови примерни данни `data/accounts.json` (acc-1..acc-4, hh-1/hh-2) и
  `data/fee-schedules.json` (`standard`, `premium`) — същата фикстура като
  `test/calculate-fees.test.ts`, така че `hh-1` за Q1 2026 дава
  `total = 14239.73`.
- Нов `ConsoleFeeReportPublisher`: един ред на **stderr** във формат
  `[publish] household hh-1 2026-01-01..2026-03-31 total=14239.73 (3 accounts)`;
  stdout остава чист (за табличния/JSON изход на CLI в STORY-1.7).
- Нов `test/out-adapters.test.ts`: общ contract тест, пуснат срещу двете
  имплементации на всеки репозиторий, тестове за формата/грешките на JSON
  файловете, тест за реда на publisher-а, и end-to-end проверка, че
  `CalculateHouseholdFeesService` над memory и над json дава същия отчет за
  `hh-1`.

## Покрити backlog елементи

- STORY-1.6 Out адаптери
  - TASK-1.6.1 InMemory репозиторита
    - SUB-1.6.1.1 InMemoryAccountRepository
    - SUB-1.6.1.2 InMemoryFeeScheduleRepository
  - TASK-1.6.2 JsonFile репозиторита
    - SUB-1.6.2.1 JsonFileAccountRepository
    - SUB-1.6.2.2 JsonFileFeeScheduleRepository
    - SUB-1.6.2.3 data/accounts.json и data/fee-schedules.json
  - TASK-1.6.3 ConsoleFeeReportPublisher
    - SUB-1.6.3.1 Формат на реда

## Capabilities

### New Capabilities

- `in-memory-repositories`: репозитории върху данни от конструктора — какво
  връщат при наличен/липсващ household или тарифа и че не мутират входа.
- `json-file-repositories`: репозитории върху `data/*.json` — формат на
  файловете, четене при всяка заявка, поведение при нечетим или неправилен
  файл, примерните данни и равенството с in-memory резултата.
- `console-report-publisher`: публикуване на отчет като един ред на stderr —
  точният формат и чистият stdout.

### Modified Capabilities

(няма) — `outbound-ports` фиксира договорите; тук се добавят имплементации,
без промяна на requirements.

## Non-goals

- Няма `bootstrap/compose.ts`, `seed.ts`, `STORAGE`/`DATA_DIR` — STORY-1.8.
  Адаптерите получават данни/път през конструктора; кой ги подава не е тема тук.
- Няма CLI/HTTP адаптери (STORY-1.7); форматът на реда на publisher-а е
  единственият изход в този change.
- Няма кеширане или наблюдение на файловете; четене при всяка заявка е
  умишлено (промяна във файла се вижда без рестарт).
- Няма пълна схема/валидация на JSON (без библиотеки); проверката е минимална
  — тип на полетата, не бизнес правила. Валидността на нивата на тарифата
  остава на `validateFeeSchedule` в domain (хвърля при изчисление).
- Няма запис във файловете (write side); репозиториите са само за четене.
- Няма SQLite (STORY-2.1) и общ contract тест като отделен модул за преизползване
  от упражнения — contract тестът живее в `test/out-adapters.test.ts`.
- Няма промяна по domain, application, портове, `package.json`, `tsconfig.json`,
  `architecture.test.ts`.

## Impact

- Нови файлове: `src/adapters/out/InMemoryAccountRepository.ts`,
  `src/adapters/out/InMemoryFeeScheduleRepository.ts`,
  `src/adapters/out/JsonFileAccountRepository.ts`,
  `src/adapters/out/JsonFileFeeScheduleRepository.ts`,
  `src/adapters/out/ConsoleFeeReportPublisher.ts`, `data/accounts.json`,
  `data/fee-schedules.json`, `test/out-adapters.test.ts`.
- `src/adapters/out/` се появява за първи път; `test/architecture.test.ts`
  започва реално да проверява правилото „adapters/out → domain, application,
  external“ (и че out адаптерите не се импортират взаимно).
- Конструкторите на адаптерите (данни / път до файл / sink) стават договор за
  `compose.ts` (STORY-1.8). Форматът на `data/*.json` става договор за
  `seed.ts` и за README (STORY-1.9).
