# Design

## Context

Налични са (вж. proposal.md — Why) всички части на хексагона:

- `CalculateHouseholdFeesService(accounts, schedules, publisher)` implements
  `CalculateHouseholdFees`;
- `InMemoryAccountRepository(accounts[])`, `InMemoryFeeScheduleRepository(schedules[])`,
  `JsonFileAccountRepository(filePath)`, `JsonFileFeeScheduleRepository(filePath)`
  — JSON репозиториите четат файла **при всяко извикване**, не в конструктора,
  значи сглобяването е синхронно и липсващ файл се вижда едва при `execute`;
- `ConsoleFeeReportPublisher(sink = process.stderr)` с експортиран тип
  `LineSink = { write(chunk: string): unknown }`;
- `createHttpServer(useCase): http.Server` (не слуша) и
  `runCli(useCase, argv, out = процесните потоци): Promise<exit code>`.

`package.json` вече има `cli: tsx src/bootstrap/cli.main.ts` и
`http: tsx src/bootstrap/http.main.ts`. `test/architecture.test.ts` позволява
`bootstrap → всичко` и вече изброява `src/bootstrap/compose.ts` и
`src/bootstrap/cli.main.ts` като примери в таблицата си. Backlog-ът фиксира
`composeApp(env)`, `STORAGE` с default `memory`, лог `[bootstrap] STORAGE=...`
на stderr, път до `data/` от `import.meta.url` с `DATA_DIR` override,
`seed.ts`, и двата едноредови entry point-а.

## Goals / Non-Goals

**Goals:**
- Един файл знае всички конкретни класове; всичко друго вижда само портове.
- `composeApp` е чиста функция от `(env, stderr)` → порт: тестваема без
  `process.env` и без да пише в реалния stderr.
- Entry point-ите са толкова тънки, че единственият смислен тест за тях е
  end-to-end през дъщерен процес — и точно такъв има.
- Memory и json дават байт за байт същия JSON за `hh-1` Q1 2026.

**Non-Goals:**
- Разделяне на `compose.ts` на „registry“/„container“; generic фабрики.
- Обработка на сигнали, `server.close()`, timeout-и в `http.main.ts`.
- Валидация на `DATA_DIR` при сглобяване (съществува ли папката) — грешката
  идва от репозиторито при първото четене, с пътя в съобщението (STORY-1.6).

## Decisions

### D1. Четири файла в `src/bootstrap/`, един тестов файл

```
src/bootstrap/
  compose.ts     export function composeApp(env = process.env, stderr: LineSink = process.stderr): CalculateHouseholdFees
  seed.ts        export const seedAccounts: readonly Account[]; export const seedFeeSchedules: readonly FeeSchedule[]
  cli.main.ts    process.exitCode = await runCli(composeApp(), process.argv.slice(2));
  http.main.ts   createHttpServer(composeApp()).listen(port, …)
test/bootstrap.test.ts
```

- Имената са от backlog-а. `*.main.ts` суфиксът отличава файловете със
  side effect при import (стартират процес) от `compose.ts`/`seed.ts`, които
  само експортират. Коментар в кода: entry point-ът не се импортира от никого
  и затова не експортира нищо.
- Без `index.ts`, без папки — както `adapters/in` и `adapters/out`.

### D2. `composeApp(env, stderr)` връща типа на порта, не на сервиза

```ts
type Env = Readonly<Record<string, string | undefined>>; // структурно = NodeJS.ProcessEnv

export function composeApp(env: Env = process.env, stderr: LineSink = process.stderr): CalculateHouseholdFees {
  const storage = env.STORAGE || "memory";
  if (storage !== "memory" && storage !== "json") {
    throw new Error(`STORAGE must be one of memory, json (got "${storage}")`);
  }
  stderr.write(`[bootstrap] STORAGE=${storage}\n`);
  const { accounts, schedules } = storage === "json" ? jsonRepositories(dataDir(env)) : memoryRepositories();
  return new CalculateHouseholdFeesService(accounts, schedules, new ConsoleFeeReportPublisher(stderr));
}
```

- **Тип на резултата `CalculateHouseholdFees`**, не
  `CalculateHouseholdFeesService`: entry point-ите (и бъдещ MCP адаптер от
  EPIC-2) получават порт. Това е същият принцип като при driving адаптерите —
  „получават порта, не сервиза“ — приложен и към composition root-а. Коментар
  в кода.
- **`env` като параметър с default `process.env`**: тестът подава `{}` или
  `{ STORAGE: "json", DATA_DIR: … }` и не пипа глобалното състояние; entry
  point-ите викат `composeApp()` без аргументи, както backlog-ът ги описва.
  `Env` е structural тип (експортиран, за да може тестът да го назове при
  нужда), за да не се изисква `NodeJS.ProcessEnv` в тестовете; `process.env`
  го удовлетворява.
- **`stderr` като параметър**: един sink за лог реда на bootstrap-а *и* за
  publisher-а. Тестът вижда и двата реда в един масив; `process.stdout`
  остава недокоснат (проверява се с `mock.method`, както в STORY-1.7).
  `LineSink` се **преизползва** от `ConsoleFeeReportPublisher` — bootstrap
  може да импортира `adapters/out`, за разлика от `adapters/in` (D5 на 1.7).
- **`||`, не `??`**: `STORAGE=""` (празно в shell) означава „не е зададено“
  → `memory`. Същото за `DATA_DIR` и `PORT`.
- **Валидация преди лога**: при непозната стойност потребителят вижда една
  грешка, не лог ред + грешка. Валидацията е синхронна и преди каквото и да
  е сглобяване, защото `composeApp` е синхронен — нищо не чете диска.
- **Грешката е plain `Error`**, не `DomainError`: конфигурацията на процеса
  не е бизнес факт; CLI адаптерът нарочно пропуска не-domain грешки нагоре
  (STORY-1.7 D5), а тук тя се хвърля още преди адаптера да е извикан.
- Алтернатива — `switch` с `default: throw`: същото, но `storage` не се
  стеснява до `"memory" | "json"` за return-а; `if` с две сравнения дава
  narrowing и се чете по-кратко.

### D3. Data папка: `import.meta.url` + `DATA_DIR`

```ts
const DEFAULT_DATA_DIR = fileURLToPath(new URL("../../data/", import.meta.url));
export const dataDirFrom = (env: Env): string => env.DATA_DIR || DEFAULT_DATA_DIR;
// jsonRepositories(dir): join(dir, "accounts.json"), join(dir, "fee-schedules.json")
```

- `dataDirFrom` е експортирана само за теста (сценарият „работната
  директория не влияе“ я вика след `process.chdir(tmpdir)` и очаква същия
  абсолютен път); entry point-ите не я ползват.

- `import.meta.url` на `compose.ts` е `file:///…/src/bootstrap/compose.ts`;
  `../../data/` от него е `<repo>/data/`, независимо от `process.cwd()`.
  `fileURLToPath`, защото репозиториите приемат път, не URL. Trailing `/`,
  за да е папка при `new URL`.
- `DATA_DIR` се взима като е (относителен път е относно cwd на процеса —
  това е очакваното поведение на env променлива; коментар). Не се
  проверява, че папката съществува: STORY-1.6 вече гарантира грешка с пътя
  в съобщението при четене, и дублирането ѝ тук би било втора истина.
- Алтернатива — `process.cwd() + "/data"`: чупи `npm run http` от друга
  директория и прави bootstrap зависим от това откъде е стартиран. Отхвърлено
  (това е и причината backlog-ът да каже `import.meta.url`).

### D4. `seed.ts` — огледало на `data/*.json`, пазено от тест

- Два `export const` масива с типове `readonly Account[]` и
  `readonly FeeSchedule[]`, литерално същите четири сметки и две тарифи.
  `as const` не се ползва: типовете от domain/ са достатъчни и `upTo: null`
  трябва да е `number | null`, не литерал.
- Защо не „memory режимът чете `data/*.json` веднъж в паметта“: тогава
  memory не би бил различен storage, а кеширан json, и учебният контраст
  „две технологии зад един порт“ изчезва. Защо не обратното („json файловете
  се генерират от seed“): файловете трябва да са редактируеми от човек в
  демото. Цената е дублиране на 30 реда — платена с тест, който
  `deepEqual`-ва seed-а срещу `JSON.parse` на файловете, така че разминаване
  пада още в `npm test`.

### D5. `cli.main.ts` — един ред, top-level `await`

```ts
process.exitCode = await runCli(composeApp(), process.argv.slice(2));
```

- Top-level `await` е валиден в ESM и `tsx` го поддържа. `process.exitCode`,
  не `process.exit()`: оставя stdout да се изпразни (STORY-1.7 D5).
- `composeApp()` без аргументи = `process.env` + `process.stderr`; `runCli`
  без `out` = процесните потоци. Всичко „процесно“ е в този ред и никъде другаде.
- Ако `composeApp` хвърли (лош `STORAGE`), грешката е необработена на
  top-level: Node печата `Error: STORAGE must be one of …` и стека на stderr
  и излиза с код 1. Това покрива „ясна грешка“ от критериите — съобщението
  е първият ред. `try/catch` около реда би добавил втори error-формат за
  едно съобщение; не се прави. Коментар в кода.

### D6. `http.main.ts` — `PORT` default 3000, лог с реалния порт

```ts
const port = Number(process.env.PORT || 3000);
const server = createHttpServer(composeApp()).listen(port, () => {
  const { port: actual } = server.address() as AddressInfo;
  process.stderr.write(`[bootstrap] listening on http://localhost:${actual}\n`);
});
```

- Логът взима порта от `server.address()`, не от `port`: при `PORT=0` OS
  дава ефимерен порт и само сървърът го знае. Това е и каквото тестът чете.
- На stderr, не stdout: stdout е за данни (CLI конвенцията от 1.7 важи и тук).
- `Number(...)` без валидация: `PORT=abc` → `NaN` → `listen` хвърля
  `ERR_SOCKET_BAD_PORT` с ясно съобщение от Node. Достатъчно за non-goal.
- Слуша на всички интерфейси (default на `listen`), логът казва `localhost`
  за удобство при копиране. Без `host` аргумент — не е цел на story-то.
- `AddressInfo` е от `node:net`; cast-ът е безопасен, защото за TCP
  `address()` връща обект след `listening`.

### D7. Тестове: `composeApp` in-process, entry point-ите като дъщерни процеси

`test/bootstrap.test.ts`, едно `describe` на spec:

- `describe("composition-root")`: `sink()` помощник (масив + `write`), както
  в 1.7. `composeApp({}, s)` → `execute(hh-1 Q1)` → `total 14239.73`, `s.lines`
  съдържа `[bootstrap] STORAGE=memory` и `[publish] …`;
  `composeApp({ STORAGE: "json" }, s)` → deepEqual отчет;
  `DATA_DIR` към `mkdtemp` папка само с `acc-4` → `hh-2` има един ред,
  `hh-1` → `HouseholdNotFound`; празна `DATA_DIR` → `execute` rejects с
  `accounts.json` в съобщението, а `composeApp` не е хвърлил;
  `STORAGE: "sqlite"` → `assert.throws` синхронно, `/STORAGE/`, `/sqlite/`,
  `/memory/`, `/json/`, `s.lines` празен; `process.stdout.write` mock-нат →
  нито един chunk със `[bootstrap]`/`[publish]`. *Отклонение при apply:* не
  „0 извиквания“, защото reporter-ът на `node --test` сам пише на stdout
  между `await`-ите и mock-ът брои и неговите редове; филтърът по съдържание
  проверява същото твърдение. Seed: `deepEqual(seedAccounts, JSON.parse(readFile(data/accounts.json)))`
  и същото за тарифите.
- `describe("entry-points")`: помощник `runMain(file, args, env)` →
  `execFile(process.execPath, ["--import", "tsx", file, ...args], { cwd: root, env })`
  (promisified; `execFile` отхвърля при ненулев код, затова се хваща и се
  четат `code`, `stdout`, `stderr` от грешката). `env` се строи като
  `{ ...process.env, STORAGE }` или с изтрит `STORAGE` за memory сценария —
  `npm test` може да е пуснат със `STORAGE=json` в обкръжението, и тестът
  не трябва да зависи от това. CLI: `--json` с memory и json → code 0,
  еднакъв stdout, `total 14239.73`; `hh-1` само → 2; `hh-404 …` → 1;
  `STORAGE=sqlite` → ненулев код, stdout празен, stderr с `STORAGE`/`sqlite`.
  HTTP: `spawn` с `PORT=0`, чете stderr до ред `listening on http://localhost:(\d+)`,
  `fetch` POST → 200 и `total 14239.73`, после `child.kill()` и `await` на
  `exit`; с `STORAGE=json` deepEqual тяло; `STORAGE=sqlite` → процесът
  излиза с ненулев код без `listening` ред. Timeout-и през
  `AbortSignal.timeout`/`setTimeout` + `kill`, за да не виси `npm test` при
  регресия.
- Сценарият „работната директория не влияе“ се проверява in-process:
  `dataDirFrom({})` е абсолютен път, завършващ на `/data/`, и е същият
  преди и след `process.chdir(tmpdir)` (възстановен в `after`; `chdir` е
  безопасен, защото `node --test` пуска всеки файл в собствен процес). Дъщерните процеси се
  пускат с `cwd: root`, защото `--import tsx` се резолвира от cwd; да се
  стартира от `/tmp` би изисквало абсолютен път до loader-а на tsx —
  излишна крехкост за това, което in-process тестът вече доказва.
- Сценарият „порт по подразбиране 3000“ **не** се автоматизира: тест, който
  слуша на 3000, пада, ако портът е зает на машината на разработчика.
  Проверен ръчно при apply (`npm run http` → `listening on
  http://localhost:3000`, `curl` дава `total 14239.73`; същото със
  `STORAGE=json PORT=3001`) и ще се повтори в демото (STORY-1.9).
- HTTP със `STORAGE=sqlite` се проверява с `runMain` (процесът завършва сам),
  не със `spawnHttp`; добавен е и тест, че HTTP main-ът не пише на stdout.

## Risks / Trade-offs

- [Дъщерните процеси забавят `npm test` с ~1–2 s и зависят от `tsx` в
  `node_modules`] → `cwd: root`, `process.execPath` за същия Node; ако
  времето стане проблем, HTTP и CLI детските процеси могат да делят един
  `describe` с `before`.
- [HTTP детето остава живо при паднал assert] → `after`/`finally` с
  `child.kill()`; общ timeout на теста.
- [`seed.ts` и `data/*.json` се разминават при редакция] → D4 тест; при
  умишлена промяна на данните се сменят и двете (документирано в README в 1.9).
- [`STORAGE=json` от обкръжението на разработчика променя какво тества
  memory сценарият] → тестовете строят `env` явно и никога не наследяват
  `STORAGE`/`DATA_DIR`/`PORT` мълчаливо.
- [`process.exitCode` + top-level `await`: ако `runCli` отхвърли с не-domain
  грешка (напр. счупен JSON файл), процесът умира с необработен reject] →
  това е умишлено от 1.7 D5: бъг/инфраструктурна грешка печата стека и код 1.
