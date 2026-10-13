# Proposal

## Why

Хексагонът има use case (STORY-1.4) и сменяеми driven адаптери (STORY-1.6),
но никой извън тестовете не може да го извика. Учебната теза на STORY-1.7 е
обратната на 1.6: два различни *протокола* (HTTP и терминал) влизат през
един и същ inbound порт `CalculateHouseholdFees`, а use case-ът не разбира
кой го вика. Без тези два адаптера composition root-ът (STORY-1.8) няма какво
да сглобява и демото (STORY-1.9) няма какво да показва.

## What Changes

- Нов HTTP driving адаптер `createHttpServer(useCase)` в `src/adapters/in/`
  върху `node:http`: `POST /households/:id/fees` с JSON тяло `{ from, to }`
  → `200` и отчетът като JSON; друг път или метод → `404`; невалиден JSON или
  липсващи/не-низови `from`/`to` → `400`; domain грешки се превеждат **само тук**:
  `InvalidBillingPeriod` → `400`, `HouseholdNotFound`/`FeeScheduleNotFound` →
  `404`, всичко друго → `500`. Всяко тяло на грешка е `{ error, message }`.
  Функцията връща несвързан (`listen` не е извикан) `http.Server`, за да може
  тестът да го вдигне на порт 0, а `http.main.ts` (STORY-1.8) — на `PORT`.
- Нов CLI driving адаптер `runCli(useCase, argv, out)` в `src/adapters/in/`:
  аргументи `<householdId> <from> <to> [--json]`; грешен брой/непознат флаг →
  usage на stderr и exit код `2`; успех → таблица (ред на сметка + `TOTAL`) или,
  с `--json`, **същият JSON като HTTP отговора** на stdout, exit `0`; domain
  грешка → един ред на stderr, exit `1`. Функцията *връща* exit кода и пише в
  подадени потоци, не вика `process.exit` — `cli.main.ts` (STORY-1.8) прави
  `process.exitCode = await runCli(...)`.
- Двата адаптера приемат **само** интерфейса `CalculateHouseholdFees`; тестовете
  ги карат с fake use case (`{ execute }`), без репозитории и без сервиза —
  това е доказателството за критерия „получават порта, не сервиза“.
- Нов `test/in-adapters.test.ts`: HTTP през реален сървър на порт 0 и глобалния
  `fetch` (рутиране, тяло, превод на грешки, формат на JSON-а), CLI през
  събиращи fake потоци (аргументи, таблица, `--json`, exit кодове), плюс
  проверка, че `--json` изходът е байт за байт равен на HTTP тялото за същия отчет.

## Capabilities

### New Capabilities
- `http-adapter`: HTTP вход към use case-а — маршрут, формат на заявка/отговор,
  превод на грешки към статуси.
- `cli-adapter`: терминален вход към use case-а — аргументи, табличен и JSON
  изход, exit кодове.

### Modified Capabilities
- (няма) — портовете, use case-ът и domain грешките не се променят; адаптерите
  само ги консумират.

## Покрити backlog елементи

- STORY-1.7 In адаптери: HTTP и CLI
  - TASK-1.7.1 HTTP адаптер
    - SUB-1.7.1.1 Рутиране
    - SUB-1.7.1.2 Парсване на тялото
    - SUB-1.7.1.3 Превод на грешки
  - TASK-1.7.2 CLI адаптер
    - SUB-1.7.2.1 Аргументи
    - SUB-1.7.2.2 Табличен изход
    - SUB-1.7.2.3 --json изход

## Non-goals

- Bootstrap/entry points (`cli.main.ts`, `http.main.ts`, избор на storage по
  `STORAGE`, `PORT`) — STORY-1.8. Тук нищо не слуша на порт и нищо не чете
  `process.argv`/`process.env`.
- Автентикация, CORS, лимит на размера на тялото, HTTPS, keep-alive тунинг,
  graceful shutdown — извън учебната цел; записани като упражнение в design.md.
- Други маршрути (GET на отчет, списък households) или други CLI команди.
- Общ модул за превод на грешки между HTTP и CLI — правилото за слоевете не
  позволява `adapters/in → adapters/in`; преводът се дублира умишлено (вж. design.md).
- README — появява се в STORY-1.9.

## Impact

- Нови файлове: `src/adapters/in/createHttpServer.ts`, `src/adapters/in/runCli.ts`,
  `test/in-adapters.test.ts`. Първите файлове в слоя `adapters/in` —
  `test/architecture.test.ts` вече има ред за него (`domain`, `application`,
  `external`) и ще го провери автоматично.
- Няма промяна в `domain/`, `application/`, `adapters/out/`, `package.json`
  (скриптовете `cli`/`http` сочат към bootstrap файлове, които идват в 1.8).
- Без нови зависимости: `node:http`, глобален `fetch` (Node ≥ 18) в тестовете.
