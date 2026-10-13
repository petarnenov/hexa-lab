# Design

## Context

Налични са (вж. proposal.md — Why): inbound портът `CalculateHouseholdFees`
(`execute(command) → Promise<FeeReport>`, отхвърля с `DomainError`),
`FeeReport` (`householdId`, `period: { from, to }`, `lines[]`, `total`),
domain грешките с стабилен `code` (`INVALID_BILLING_PERIOD`,
`HOUSEHOLD_NOT_FOUND`, `FEE_SCHEDULE_NOT_FOUND`, `INVALID_FEE_SCHEDULE`) и
коментарът в `errors.ts`, който изрично казва: външните слоеве превеждат по
`instanceof`/`code`, никога по `message`.

`test/architecture.test.ts` вече enforce-ва `adapters/in → domain,
application, external`. Следствие, същото като в STORY-1.6 D4: **два файла в
`adapters/in/` не могат да се импортират взаимно**, значи HTTP и CLI не могат
да споделят модул за превод на грешки или тип за поток. `LineSink` от
`ConsoleFeeReportPublisher` също е недостъпен (`adapters/in → adapters/out` е
забранено).

Backlog-ът фиксира сигнатурите: `createHttpServer(useCase)` върху `node:http`
и `runCli(useCase, argv, out)` връща exit код; STORY-1.8 ще ги вика с
`createHttpServer(composeApp()).listen(PORT)` и
`process.exitCode = await runCli(composeApp(), argv)`. `ConsoleFeeReportPublisher`
пише на stderr точно за да остави stdout на CLI изхода — CLI тук се възползва.

## Goals / Non-Goals

**Goals:**
- Два адаптера, чийто единствен вход от хексагона е типът
  `CalculateHouseholdFees`; тестовете ги карат с `{ execute }` обект.
- Целият протокол (парсване, статуси, exit кодове, формати) е в адаптера;
  нито ред протокол не изтича в application/domain.
- Еднакъв JSON на HTTP и CLI `--json` — буквално един и същ `JSON.stringify(report)`.
- Нищо не докосва `process` освен по подразбиране (`out` default = процесните потоци).

**Non-Goals:**
- Routing таблица/framework, middleware, лимит на тялото, CORS, auth, shutdown.
- Общ error-mapper модул между двата адаптера (забранено от слоевете; виж D6).
- Формат на парите с хиляди/валута; локализация.

## Decisions

### D1. Два файла в `src/adapters/in/`, по една експортирана функция, плоско

```
src/adapters/in/
  createHttpServer.ts   export function createHttpServer(useCase: CalculateHouseholdFees): http.Server
  runCli.ts             export async function runCli(useCase, argv, out = processOutput): Promise<number>
test/in-adapters.test.ts
```

- Плоско като `adapters/out/` (STORY-1.6 D1); име на файла = име на функцията,
  както backlog-ът ги назовава. Подпапки `http/`, `cli/` (backlog-ът споменава
  `adapters/in/mcp` за EPIC-2) не са оправдани за два файла; EPIC-2 може да
  ги въведе, ако MCP адаптерът стане повече от един файл.
- Функции, не класове: driving адаптерът няма състояние и не `implements`
  порт — той *консумира* порт. Класът би бил шум. (Driven адаптерите са класове,
  защото изпълняват интерфейс; контрастът е умишлен и се коментира в кода.)
- Без `index.ts`: bootstrap импортира по име (STORY-1.6 D1).

### D2. HTTP: `node:http` сървър, един `requestListener`, без да слуша

```ts
export function createHttpServer(useCase: CalculateHouseholdFees): Server {
  return createServer((req, res) => { void handle(useCase, req, res); });
}
```

- Връща `Server` без `listen`: тестът прави `server.listen(0)` и чете
  `server.address().port`; `http.main.ts` (1.8) ще подаде `PORT`. Така адаптерът
  не знае нищо за портове/env — критерият „нищо не чете `process.env`“.
- `handle` е `async` функция с един `try/catch` отгоре: всичко, което хвърли
  (парсване, use case, бъг), минава през **един** превод към отговор. `void`
  пред извикването, защото `createServer` не очаква Promise; всяко отхвърляне е
  вече хванато вътре. Коментар в кода защо.
- Пътят се парсва с `new URL(req.url, "http://localhost")` (нужен е base за
  относителен path) и `pathname.split("/")` → `["", "households", id, "fees"]`;
  `decodeURIComponent(id)` и `id !== ""`. Query string се игнорира. Без regex
  routing таблица — един маршрут, един `if`.
- Редът на проверките: метод+път (404) → тяло (400) → use case. 404 преди 400,
  защото за непознат път тялото е без значение и не трябва да се чете.

### D3. HTTP: тяло → `CalculateHouseholdFeesCommand`, минимален guard

```ts
async function readJsonBody(req): Promise<unknown>     // chunks → utf8 → JSON.parse; грешка → BadRequest
function toCommand(householdId, body: unknown): CalculateHouseholdFeesCommand
  // typeof body === "object" && body !== null && !Array.isArray(body)
  // typeof body.from === "string", typeof body.to === "string" → иначе BadRequest("from must be a string")
```

- Guard-ът проверява само *формата* (обект с два низа), не *съдържанието* —
  датата я валидира `createBillingPeriod` в use case-а и грешката ѝ се превежда
  като всяка друга `InvalidBillingPeriod`. Това е точката на урока от
  `CalculateHouseholdFees.ts`: „адаптерът не трябва да знае как се валидира дата“.
- `BadRequest` е **локален** клас в `createHttpServer.ts` (`class BadRequest extends
  Error { readonly code = "BAD_REQUEST" }`), не domain грешка: „лош JSON“ е факт
  на HTTP протокола, не на бизнеса, и не бива да замърсява `domain/errors.ts`.
  Той се хваща от същия `catch` като domain грешките → `400`.
- Тялото се чете изцяло в паметта (`for await (const chunk of req)`), без лимит
  — учебен проект, записано като упражнение (Risks).

### D4. HTTP: превод на грешки по `instanceof`, един `respond` помощник

```ts
function statusOf(error: unknown): { status: number; body: { error: string; message: string } } {
  if (error instanceof BadRequest || error instanceof InvalidBillingPeriod) return { status: 400, body: { error: error.code, message: error.message } };
  if (error instanceof HouseholdNotFound || error instanceof FeeScheduleNotFound) return { status: 404, body: { ... } };
  return { status: 500, body: { error: "INTERNAL_ERROR", message: "Internal server error" } };
}
function respond(res, status, body: unknown): void  // writeHead(status, {"Content-Type": "application/json; charset=utf-8"}); end(JSON.stringify(body))
```

- `instanceof` на конкретните класове, не `switch (code)`: при добавяне на нова
  domain грешка `tsc` не помага и в двата случая, но `instanceof` ползва само
  публичното API на `errors.ts` и чете като спецификацията (SUB-1.7.1.3).
  `InvalidFeeSchedule` умишлено пада в `500`: лоша тарифа е проблем в данните на
  сървъра, не в заявката на клиента.
- `500` връща общ текст; реалната грешка **не** се връща на клиента. Да се
  логва ли на stderr? Да — `console.error(error)` в `500` клона, за да не изчезва
  бъг безследно при демото; тестът го заглушава с `mock.method(console, "error")`
  и проверява, че е извикан точно веднъж.
- *Уточнение при apply:* `statusOf` връща `{ status, body }` (готовото тяло), а не
  плоско `{ status, error, message }` — така `respond(res, status, body)` се вика
  еднакво за успех и грешка, без да се сглобява обект в `catch`-а.
- Успехът минава през същия `respond(res, 200, report)`: `JSON.stringify(report)`
  без replacer/indent — това е **текстът**, който CLI `--json` трябва да повтори (D5).

### D5. CLI: `runCli(useCase, argv, out)` → `Promise<number>`, изход само през `out`

```ts
export type TextSink = { write(chunk: string): unknown };
export type CliOutput = { readonly stdout: TextSink; readonly stderr: TextSink };
export async function runCli(
  useCase: CalculateHouseholdFees,
  argv: readonly string[],                     // БЕЗ node и script — bootstrap дава process.argv.slice(2)
  out: CliOutput = { stdout: process.stdout, stderr: process.stderr },
): Promise<number>
```

- `TextSink` е дубликат на `LineSink` от `ConsoleFeeReportPublisher` — не може
  да се импортира (`adapters/in → adapters/out` е забранено), а да се качи в
  `application/` би било грешно: типът на поток е адаптерска грижа. Коментар в кода.
- Exit кодове като *стойност*: `0` успех, `1` domain грешка, `2` usage. Конвенция
  на Unix (`2` = неправилна употреба, както `grep`/`bash`). Експортирани като
  `EXIT_OK` / `EXIT_FAILED` / `EXIT_USAGE` (добавено при apply — bootstrap и
  тестовете да не повтарят магически числа). `process.exit` би убил
  pending stdout flush и би направил функцията нетестваема.
- Парсване на `argv`: раздели на флагове (`startsWith("--")`) и позиционни;
  единственият познат флаг е `--json`; друг флаг или `positional.length !== 3` →
  usage на stderr, `return 2`. Usage редът:
  `usage: <householdId> <from> <to> [--json]` — без име на програмата, защото
  адаптерът не знае дали го викат през `npm run cli`, `tsx` или binary.
- Отхвърляне на use case-а: `catch (error) { if (error instanceof DomainError) {
  stderr.write(`${error.code}: ${error.message}\n`); return 1; } throw error; }`.
  Не-domain грешка се **пропуска нагоре**: това е бъг или инфраструктурен срив,
  Node ще го отпечата със stack и ще излезе с `1` сам — поглъщането му би скрило
  причината. Проверка по базовия `DomainError`, не по конкретните класове: за CLI
  всяка domain грешка е еднакво „exit 1“, разликата е само в текста.

### D6. CLI: таблица с `padEnd`/`padStart`, пари с `toFixed(2)`; JSON е `JSON.stringify(report)`

```
Household hh-1  2026-01-01..2026-03-31
acc-1  Alpha  2500000  standard   5239.73
acc-2  Beta    150000  standard    616.44
acc-3  Gamma  4000000  premium    8383.56
TOTAL                            14239.73
```

- Ширините се изчисляват от данните (max дължина по колона), пари дясно
  подравнени с `toFixed(2)`; `aum` като цяло число без десетични (`String(aum)`).
  Таблицата е за хора, затова тук `toFixed(2)` е правилният избор, за разлика
  от publisher-а и JSON-а, където числото се подава сурово — двата формата
  живеят в два различни адаптера и не се смесват. (Точният брой интервали е
  детайл на имплементацията; spec-ът и тестовете фиксират *съдържанието* на
  редовете и формата на последния ред `TOTAL\s+<total>`.) Колони `aum` и `fee`
  са дясно подравнени, текстовите — ляво; `trimEnd()` на реда, за да няма
  trailing интервали след `TOTAL`-реда с празни клетки.
- `--json`: `out.stdout.write(JSON.stringify(report) + "\n")` — същото извикване
  като в D4, без indent, за да е **байт за байт** равно на HTTP тялото.
  Тестът го проверява директно (един отчет → двата адаптера → равни низове).
  Pretty-print би бил по-четим в терминал, но би счупил критерия „същият JSON“ и
  `| jq` го форматира и така.
- Преводът на `DomainError` → текст е дублиран спрямо D4, както 1.6 D4 дублира
  guard-а: общият модул би нарушил слоевете, а двата превода са различни по
  природа (статус срещу exit код) — приликата е повърхностна.

### D7. Тестове: един файл, реален сървър на порт 0, fake use case

- `test/in-adapters.test.ts` с `describe("http-adapter")` и `describe("cli-adapter")`,
  един `test` на scenario (конвенция от 1.5/1.6).
- Fake: `function fakeUseCase()` → `{ useCase, calls, arm(next) }`, където
  `useCase: CalculateHouseholdFees = { execute: async (cmd) => { calls.push(cmd);
  if (outcome instanceof Error) throw outcome; return outcome; } }`, а `arm(next)`
  нулира `calls` и задава какво връща/хвърля следващото изпълнение. Типизирането
  към порта е самата проверка на критерия „приема порта, не сервиза“.
- HTTP: `before` → `server.listen(0)`, `after` → `server.close()`; заявки с
  глобалния `fetch` (Node 24) към `http://127.0.0.1:${port}`. Един сървър на
  `describe`-блок с един fake, пренасочван с `arm(...)` преди всеки тест — по-бързо
  и по-просто от сървър на тест. Тестът „същият JSON като HTTP“ в CLI блока вдига
  свой кратък сървър.
- Отчетът-фикстура се строи с `buildFeeReport` върху трите реда на `hh-1` с
  таксите от `calculate-fees.test.ts` (5239.73, 616.44, 8383.56) → `total 14239.73`;
  не минава през сервиза — сервизът не участва в този тест по дефиниция.
  (Планът грешно записа 625/8375 — коригирано при apply по реалната фикстура.)
- CLI: `sink()` връща `{ write, text() }` (събира chunk-овете), а помощникът
  `run(argv, outcome)` прави fresh fake + fresh sinks и връща `{ code, stdout, stderr, calls }`
  — един ред на тест. Тестът „не докосва process“ ползва
  `mock.method(process.stdout, "write", () => true)` като в 1.6 задача 3.3.

## Risks / Trade-offs

- [Тялото се чете без лимит → лесен DoS] → учебен проект без мрежа навън;
  записано като упражнение (добави `413` при > 1 MiB) в README (STORY-1.9).
- [Пропуснатата не-domain грешка в CLI печата stack trace на потребителя] →
  умишлено: показва бъг, не потребителска грешка; bootstrap (1.8) може да го
  обвие, ако демото го поиска.
- [Таблицата зависи от `accountName` без интервали за визуално подравняване] →
  фикстурата има едносрични имена; `padEnd` работи и с интервали, само колоните
  „плуват“ за човек. Spec-ът не фиксира броя интервали.
- [`console.error` в `500` клона цапа TAP изхода на тестовете] → заглушава се
  с `mock.method(console, "error", () => {})` в теста за `500`, restore след това.
- [Fake use case не доказва, че *реалният* сервиз работи зад адаптерите] →
  това е целта: end-to-end с реалните адаптери и storage е демото на STORY-1.9
  и `EPIC-1` критерият (`total: 14239.73` през CLI и HTTP).
