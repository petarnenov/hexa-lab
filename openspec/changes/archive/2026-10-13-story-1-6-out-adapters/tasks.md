# Tasks

## 1. TASK-1.6.1 InMemory репозиторита

- [x] 1.1 Сложи `status: in-progress` на `backlog/.../STORY-1.6.md` (само frontmatter); провери с `grep -rl '^status: in-progress' backlog`, че това е единственият елемент в работа.
- [x] 1.2 (SUB-1.6.1.1) Създай `test/out-adapters.test.ts` с фикстурата `acc-1..acc-4`, `standard`, `premium` (копие от `calculate-fees.test.ts`, design.md D6) и `describe("in-memory-repositories")`: `hh-1` от вход `acc-3, acc-1, acc-4, acc-2` → `acc-3, acc-1, acc-2` в този ред; `hh-404` → `[]`; входният масив остава непроменен и повторно запитване дава същия ред след като извикващият е мутирал резултата. Провери, че `npm test` пада заради липсващия модул.
- [x] 1.3 (SUB-1.6.1.1) Създай `src/adapters/out/InMemoryAccountRepository.ts` по design.md D2 (`class … implements AccountRepository`, копие на входа в конструктора, `filter` по `householdId`), с коментар защо `async` върху синхронен код и защо копие. Провери, че тестовете от 1.2 минават.
- [x] 1.4 (SUB-1.6.1.2) Добави тестове: `premium` → deepEqual с подадената тарифа; `vip` → `undefined`; дублиран `id` във входа → последният печели. Провери, че падат.
- [x] 1.5 (SUB-1.6.1.2) Създай `src/adapters/out/InMemoryFeeScheduleRepository.ts` по D2 (`Map` от `schedules.map`), с коментар за „последният печели“. Провери, че тестовете от 1.4 минават.
- [x] 1.6 Добави теста „use case над паметта“: `new CalculateHouseholdFeesService(memAcc, memSch, spyPublisher)` за `hh-1` Q1 2026 → три реда, `total = 14239.73`. Провери, че минава без промяна в сервиза.
- [x] 1.7 `npm run typecheck && npm test` минават (вкл. `architecture.test.ts` с новите файлове в `adapters/out/`).

## 2. TASK-1.6.2 JsonFile репозиторита

- [x] 2.1 (SUB-1.6.2.3) Създай `data/accounts.json` и `data/fee-schedules.json` по design.md D6 — масиви едно към едно с `Account`/`FeeSchedule`, 2-интервален indent. Провери с `node -e 'JSON.parse(require("fs").readFileSync("data/accounts.json","utf8"))'` за двата файла.
- [x] 2.2 (SUB-1.6.2.1) Добави в теста `describe("json-file-repositories")`: над `data/accounts.json` (път чрез `fileURLToPath(new URL("../data/…", import.meta.url))`) `hh-1` → `acc-1, acc-2, acc-3`; `hh-404` → `[]`; deepEqual на четирите сметки със spec-а; temp файл (`mkdtemp` в `os.tmpdir()`, `after` → `rm -r`) с една сметка за `hh-9`, презапис с две, второ запитване → 2 (четене при всяка заявка). Провери, че падат заради липсващия модул.
- [x] 2.3 (SUB-1.6.2.1) Създай `src/adapters/out/JsonFileAccountRepository.ts` по design.md D3: `constructor(filePath)`, `readAll()` с `readFile` + `JSON.parse` + guard (масив; `id`/`householdId`/`name`/`feeScheduleId` низове, `aum` число), грешки обвити с пътя. Коментар защо се чете при всяка заявка и защо грешката е обикновен `Error`. Провери, че тестовете от 2.2 минават.
- [x] 2.4 (SUB-1.6.2.1) Добави тестовете за лоши файлове: липсващ път → reject с пътя в `message`; `{ not json` → reject с пътя; `aum` като низ → reject с пътя и `aum`; `{"accounts": []}` → reject със съобщение за масив. Провери, че минават (guard-ът от 2.3 трябва да ги покрива; ако не — поправи guard-а, не теста).
- [x] 2.5 (SUB-1.6.2.2) Добави тестове: над `data/fee-schedules.json` `standard` → deepEqual с трите нива и минимум 2 500; `premium` → едно ниво `null`@85, минимум 5 000; `vip` → `undefined`; temp файл с `tiers` не-масив → reject с пътя и `tiers`. Провери, че падат.
- [x] 2.6 (SUB-1.6.2.2) Създай `src/adapters/out/JsonFileFeeScheduleRepository.ts` по D3/D4: същият `readAll` guard, дублиран умишлено, с коментар, че общ модул между адаптери е забранен от правилото за слоевете (`architecture.test.ts`). Провери, че тестовете от 2.5 минават.
- [x] 2.7 Добави contract функцията от design.md D7 (`repositoryContract(name, make)`), извикана за memory и за json — сортирани id-та за `hh-1`, `[]` за `hh-404`, `standard` deepEqual, `vip` undefined — и end-to-end теста „същият отчет през двата storage-а“: два `CalculateHouseholdFeesService` (memory върху фикстурата, json върху `data/`) → `assert.deepEqual(reportMem, reportJson)` и `total === 14239.73`. Премахни дублираните единични тестове, които contract-ът вече покрива. Провери, че минават.
- [x] 2.8 `npm run typecheck && npm test` минават; `architecture.test.ts` потвърждава, че `JsonFile*` импортират само `application/ports/out`, `domain` и `node:fs/promises`.

## 3. TASK-1.6.3 ConsoleFeeReportPublisher

- [x] 3.1 (SUB-1.6.3.1) Добави `describe("console-report-publisher")`: fake sink `{ write: (s) => lines.push(s) }`; отчет `hh-1` Q1 2026 с три реда и `total 14239.73` (през `buildFeeReport`) → `lines` е точно `["[publish] household hh-1 2026-01-01..2026-03-31 total=14239.73 (3 accounts)\n"]`; отчет с един ред → завършва с `(1 account)\n`; `await publish(...)` → `undefined`. Провери, че падат заради липсващия модул.
- [x] 3.2 (SUB-1.6.3.1) Създай `src/adapters/out/ConsoleFeeReportPublisher.ts` по design.md D5: `LineSink` тип, `constructor(sink = process.stderr)`, един `write` с точния формат, `account`/`accounts` по брой редове. Коментар защо stderr (stdout е за CLI изхода) и защо `${total}` без `toFixed`. Провери, че тестовете от 3.1 минават.
- [x] 3.3 Добави теста „по подразбиране stderr“: `mock.method(process.stderr, "write", () => true)` и същото за `stdout`, `new ConsoleFeeReportPublisher().publish(report)`, после `stderr.write.mock.callCount() === 1` с аргумент = точният ред и `stdout.write.mock.callCount() === 0`; restore веднага след assert-ите. Добави и теста „заменен поток не докосва process“ (същите mock-ове + fake sink → 0 извиквания). Провери, че минават и че TAP изходът на `npm test` не е повреден.
- [x] 3.4 `npm run typecheck && npm test` минават.

## Workflow follow-up

- Sync docs: прегледай `design.md`, `proposal.md` и трите delta spec-а срещу реалния код и поправи отклоненията (с едно изречение *защо* в design.md); няма `README.md` още.
- `/opsx:archive story-1-6-out-adapters` — създава `openspec/specs/{in-memory-repositories,json-file-repositories,console-report-publisher}/` и сменя status на STORY-1.6, TASK-1.6.x и SUB-1.6.x.y на `done`.
- `/commit`, после `/clear`.
