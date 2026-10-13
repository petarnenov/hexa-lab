# Design

## Context

Всичко, което README трябва да опише, вече съществува и е проверено от
тестове (вж. proposal.md — Why):

- слоеве: `src/domain/` (6 файла), `src/application/` (сервиз + `ports/in`,
  `ports/out`), `src/adapters/in/` (`createHttpServer.ts`, `runCli.ts`),
  `src/adapters/out/` (2×InMemory, 2×JsonFile, `ConsoleFeeReportPublisher`),
  `src/bootstrap/` (`compose.ts`, `seed.ts`, `cli.main.ts`, `http.main.ts`);
- правило за зависимостите: таблицата `ALLOWED` в `test/architecture.test.ts`
  (domain → domain; application → domain, application; adapters/in|out →
  domain, application, external; bootstrap → всичко);
- конфигурация: `STORAGE` (`memory`|`json`, default `memory`), `DATA_DIR`
  (default `<repo>/data/`), `PORT` (default `3000`); лог редове на stderr
  `[bootstrap] STORAGE=…`, `[bootstrap] listening on http://localhost:…`,
  `[publish] household hh-1 2026-01-01..2026-03-31 total=14239.73 (3 accounts)`;
- реален изход на `npm run cli -- hh-1 2026-01-01 2026-03-31` (stdout):

  ```
  Household hh-1  2026-01-01..2026-03-31
  acc-1  Alpha  2500000  standard   5239.73
  acc-2  Beta    150000  standard    616.44
  acc-3  Gamma  4000000  premium    8383.56
  TOTAL                            14239.73
  ```

  а с `--json` (и като HTTP тяло) един ред:
  `{"householdId":"hh-1","period":{"from":"2026-01-01","to":"2026-03-31"},"lines":[…],"total":14239.73}`;
  `hh-404` дава `HOUSEHOLD_NOT_FOUND: Household not found: hh-404`, exit 1,
  а през HTTP `404 {"error":"HOUSEHOLD_NOT_FOUND","message":"Household not found: hh-404"}`.

Ограничения от `openspec/specs/project-toolchain`: npm скриптовете ползват
само `node`, `npm` и dev зависимостите, без shell-специфичен синтаксис; без
runtime зависимости. `tsconfig.json` днес включва само `src` и `test`.
`test/architecture.test.ts` обхожда само `src/`, затова нов код извън `src/`
не го засяга. `.gitignore`: `node_modules/`, `*.bak`, `*.tsbuildinfo`,
`*.log`, `.DS_Store`.

Решения на потребителя при propose: README на **английски**; доставката
(SUB-1.9.2.3) е **архив `hexa.tar.gz`**, направен от npm скрипт.

## Goals / Non-Goals

**Goals:**
- README, което учещият чете *преди* кода: диаграма → папки → команди →
  упражнения, без да изисква познания за OpenSpec или backlog-а.
- Всичко в README е изпълнимо и вярно днес — и остава вярно, защото тест го
  пази и защото правилото „sync docs“ го обновява при всяко следващо story.
- Доставката е една команда (`npm run pack`), преносима, без външни процеси.

**Non-Goals:**
- README да документира OpenSpec процеса подробно — за това е `CLAUDE.md`;
  README само сочи към `backlog/` и `openspec/`.
- Общ tar/gitignore инструмент — скриптът прави точно едно нещо за точно
  този проект.
- Байт-за-байт възпроизводим архив (фиксиран mtime, ред) — не е цел на
  учебна доставка.

## Decisions

### D1. Структура на README.md

```
# hexa-lab
  едно изречение: какво е (tiered AUM fees, Hexagonal Architecture, teaching)
## The hexagon              (SUB-1.9.1.1)
  ASCII диаграма (D2) + таблица слой → папка → „какво може да импортира“ +
  едно изречение за test/architecture.test.ts
## Running it               (SUB-1.9.1.2)
  ### Install and test      npm install / npm test / npm run typecheck
  ### CLI                   команда + реалната таблица + --json
  ### HTTP                  npm run http + curl успех + curl 404
  ### Switching storage     STORAGE=memory|json, DATA_DIR, PORT; „src/ does not change“
  ### Demo: same total, four ways   (TASK-1.9.2) CLI×2, HTTP×2 с реалния изход
## Exercises                (SUB-1.9.1.3)
  1..5 — по един параграф: цел, подсказка, линк към backlog STORY-2.x
## How this repo is worked on
  два реда: backlog/ (какво), openspec/ (как), CLAUDE.md; npm run pack за архив
```

- Английски: както кодът, коментарите и commit съобщенията; README е
  „лицето“ на repo-то за външен читател. Алтернатива (български като
  CLAUDE.md и backlog-а) беше предложена; потребителят избра английски.
- Заглавията на секциите не са фиксирани от тест — тестът (D5) проверява
  *съдържание* (низове), не структура, за да може README да се
  пренарежда без да чупи теста.
- „Running it“ показва командите точно както ще бъдат изпълнени при apply,
  а изходът се вмъква от реалното изпълнение, не се пише наизуст.

### D2. ASCII хексагон с реалните пътища

```
                       driving (in) adapters
          ┌────────────────────┐   ┌────────────────────┐
          │ src/adapters/in/   │   │ src/adapters/in/   │
          │ runCli.ts          │   │ createHttpServer.ts│
          └─────────┬──────────┘   └──────────┬─────────┘
                    │  calls                   │
                    ▼                          ▼
        ╭──────────────────────────────────────────────────╮
        │  inbound port  src/application/ports/in/         │
        │                CalculateHouseholdFees.ts         │
        │  ┌────────────────────────────────────────────┐  │
        │  │ use case  src/application/                 │  │
        │  │           CalculateHouseholdFeesService.ts │  │
        │  │   ┌────────────────────────────────────┐   │  │
        │  │   │ domain  src/domain/                │   │  │
        │  │   │  tieredFee, FeeReport, errors, …   │   │  │
        │  │   └────────────────────────────────────┘   │  │
        │  └────────────────────────────────────────────┘  │
        │  outbound ports  src/application/ports/out/      │
        │    AccountRepository · FeeScheduleRepository ·   │
        │    FeeReportPublisher                            │
        ╰──────────────────────────────────────────────────╯
                    ▲                          ▲
                    │  implements              │
          ┌─────────┴──────────┐   ┌──────────┴─────────┐
          │ src/adapters/out/  │   │ src/adapters/out/  │
          │ InMemory*.ts       │   │ JsonFile*.ts       │
          │ Console…Publisher  │   │                    │
          └────────────────────┘   └────────────────────┘
                       driven (out) adapters

   src/bootstrap/compose.ts  — the only file that sees every box above;
   STORAGE=memory|json picks which driven adapters go behind the ports.
```

- Горното е скицата от propose; **README.md е окончателната форма** (надписи
  на стрелките „call the port“ / „implement the ports“, изброени domain
  файлове) — не се дублира тук, за да има една истина.
- Диаграмата е в code block, за да не я „оправя“ markdown рендерът. Знаците
  са Unicode box-drawing (както `├`/`└` в `backlog/README.md`); ASCII `+--|`
  би било по-преносимо за терминал без UTF-8, но проектът вече ползва UTF-8
  навсякъде (български текст). Финалната форма се шлифова при apply, но
  всяка кутия носи реален път — това е учебната теза на SUB-1.9.1.1.
- Под диаграмата: таблица „layer | folder | may import“, преписана от
  `ALLOWED` в `test/architecture.test.ts`, и изречението, че този тест
  гърми при нарушение (така упражнение 5 има къде да сочи).

### D3. Демото: четири пъти едно и също число

- **CLI**: `npm run cli -- hh-1 2026-01-01 2026-03-31` и
  `STORAGE=json npm run cli -- hh-1 2026-01-01 2026-03-31 --json`.
- **HTTP**: два сървъра едновременно, за да се види, че са един и същ код с
  различна env: `npm run http` (memory, 3000) и
  `STORAGE=json PORT=3001 npm run http`; към всеки
  `curl -s -X POST localhost:<port>/households/hh-1/fees -H 'content-type: application/json' -d '{"from":"2026-01-01","to":"2026-03-31"}'`;
  плюс 404: същото с `hh-404`. (`-H content-type` не е нужен на адаптера —
  той не гледа header-а — но е коректният пример за читател.)
- Изходът се показва в нишката при apply (TASK-1.9.2 „показване на изхода в
  нишката“) и *същият* текст влиза в README секцията „Demo“. Никакъв нов код:
  всичко е вече покрито от `test/bootstrap.test.ts` (CLI/HTTP × memory/json)
  и `test/in-adapters.test.ts` (404).
- Алтернатива: скрипт `demo.sh`, който пуска всичко наведнъж — отхвърлена:
  shell скрипт нарушава духа на „само node/npm“, а стойността на демото е
  човек да види четирите команди поотделно.

### D4. `scripts/pack-demo.ts` — tar.gz само с Node

```
scripts/pack-demo.ts
  usage: tsx scripts/pack-demo.ts [outFile]   (default: <repo>/hexa.tar.gz)
  1. root = fileURLToPath(new URL("..", import.meta.url))   — не cwd
  2. walk(root) рекурсивно, сортирано; пропуска:
       директории: .git, node_modules
       файлове:    resolve(outFile), *.bak, *.tsbuildinfo, *.log, *.tar.gz, .DS_Store,
                   session-report-*.html
     (явен списък; коментар: „mirrors .gitignore — update both“)
  3. за всеки файл: ustar header (512 B) + съдържание, padded до 512;
     име = "hexa/" + posix relative path; ако > 100 знака → split на
     последния "/" така, че name ≤ 100 и prefix ≤ 155, иначе throw
     (path too long for ustar); mode 0644 (0755 ако изпълним), mtime от stat,
     uid/gid 0, uname/gname "hexa", typeflag "0", magic "ustar\0" "00"
  4. 2 × 512 нулеви блока; целият буфер → zlib.gzipSync → writeFileSync(outFile)
  5. stderr: "[pack] wrote <outFile> (<n> files)"
```

- **Защо ustar на ръка, а не `tar`/`git archive` в shell**: спецът
  `project-toolchain` казва „само node, npm и dev зависимостите“. `tar -czf`
  би бил еднакъв на macOS и Linux, но `--transform` (GNU) / `-s` (BSD) за
  префикса `hexa/` не са; `git archive --prefix=hexa/` е преносим, но
  архивира само commit-нати файлове, а README тестът трябва да минава преди
  commit. Ustar header-ът е 15 полета и ~40 реда код — цена, която учебен
  проект може да плати, и читателят вижда *защо* архивът няма `node_modules`
  (защото ние решихме кой файл влиза).
- **Защо `scripts/`, а не `src/bootstrap/`**: не е част от хексагона и не
  трябва да минава през `architecture.test.ts` (няма слой). `tsconfig.json`
  `include` става `["src", "test", "scripts"]`, за да го типизира
  `npm run typecheck` (оттук MODIFIED изискването в spec-а).
- **Защо явен exclude списък, а не парсер на `.gitignore`**: пет правила;
  парсерът би бил повече код от скрипта. Рискът (нов `.gitignore` ред,
  който не е огледан) е приет и записан в Risks.
- **Защо аргумент за изходен път**: тестът пише в temp папка и не оставя
  `hexa.tar.gz` в repo-то след `npm test`.
- `hexa.tar.gz` → `.gitignore` (архивът не е source). npm скрипт:
  `"pack": "tsx scripts/pack-demo.ts"`.

### D5. Тестове: `test/readme.test.ts` и `test/pack-demo.test.ts`

- `readme.test.ts` чете `README.md` през `new URL("../README.md", import.meta.url)`
  и проверява с `assert.match`/`includes`, по един `test` на твърдение, за да
  казва името на теста какво липсва:
  - съществува и не е празно;
  - съдържа `src/domain/`, `src/application/`, `src/adapters/in/`,
    `src/adapters/out/`, `src/bootstrap/`;
  - съдържа `npm install`, `npm run cli`, `npm run http`, `npm test`,
    `npm run typecheck`, `STORAGE=json`, `DATA_DIR`, `PORT`;
  - съдържа `14239.73` и `HOUSEHOLD_NOT_FOUND`;
  - съдържа точно пет линка, съвпадащи с
    `/backlog\/EPIC-2-exercises\/STORY-2\.[1-5]-[a-z-]+\/STORY-2\.[1-5]\.md/g`,
    по един за всяко от 2.1–2.5; и `test/architecture.test.ts`.
  Никаква проверка на заглавия/ред — виж D1.
- `pack-demo.test.ts`: `mkdtemp`, пуска скрипта като дъщерен процес
  (`execFile(process.execPath, ["--import","tsx", script, out])`, както
  `bootstrap.test.ts` пуска entry point-ите), после `gunzipSync` и малък
  ustar reader в теста (име = prefix + "/" + name, size октално, skip
  padded content) → списък имена. Assert: всички започват с `hexa/`; никое
  не съдържа `/node_modules/` или `/.git/`; включва `hexa/README.md`,
  `hexa/package.json`, `hexa/src/bootstrap/compose.ts`,
  `hexa/data/accounts.json`, `hexa/test/architecture.test.ts`; второ
  пускане към същия път презаписва и не съдържа `hexa/hexa.tar.gz`.
  `rm` на temp папката в `after`.
- Четецът в теста е огледало на писача — self-consistent бъг би минал.
  Мерки: (а) задача в tasks.md изисква ръчно `tar -tzf hexa.tar.gz` и
  `tar -xzf` + `npm install && npm test` в temp папка веднъж при apply;
  (б) четецът проверява и `magic === "ustar"` и checksum-а на всеки header,
  което хваща грешен offset в писача.

### D6. Какво става с SUB-1.9.2.3 „Доставка“

Оригиналното задание е от чат контекст („копие в проектните файлове като
`hexa/`“). В git repo това става: `npm run pack` → `hexa.tar.gz` в корена,
не комитнат; README казва как се прави и как се разархивира. Задачата е
„done“, когато архивът е генериран при apply и тестът от D5 минава.
Алтернативи (repo-то е доставката; `rsync` в `~/hexa/`) бяха предложени и
отхвърлени от потребителя.

## Risks / Trade-offs

- [README остарява при следващи story-та] → `readme.test.ts` хваща
  преименувани папки/команди; правилото „sync docs“ в CLAUDE.md и
  `config.yaml` изисква README update при всяко story.
- [Exclude списъкът се разминава с `.gitignore`] → коментар и в двата файла;
  `pack-demo.test.ts` проверява поне `node_modules` и `.git`.
- [Път > 255 знака в ustar] → скриптът хвърля с пътя в съобщението, не
  орязва мълчаливо; днес най-дългият път (`openspec/changes/archive/…/specs/…/spec.md`)
  е ~115 знака и минава през prefix split.
- [Писач и четец на tar споделят грешка] → ръчна проверка с OS `tar` в
  tasks.md + magic/checksum проверка в четеца.
- [Диаграмата не се рендерира еднакво] → code block, моноширинен шрифт,
  box-drawing символи, които GitHub и терминалите с UTF-8 показват; ширина
  ≤ 72 колони.
- [Двата HTTP сървъра в демото се объркват] → различни портове (3000/3001)
  и stderr редът `[bootstrap] STORAGE=…` на всеки показва кой е кой.

## Отклонения при apply

- **Exclude списъкът има и `*.tar.gz`** (D4), не само `resolve(outFile)`:
  архив, записан под друго име или с относителен път от друга cwd, също не
  бива да се пакетира; суфиксът е по-евтин и по-сигурен от сравнение на
  пътища. `.gitignore` има само `hexa.tar.gz` — огледалото е „по дух“.
- **Exclude списъкът има и `session-report-*.html`** (D4): ред, който
  плъгин на Claude Code добави в `.gitignore` по време на apply; огледалото
  го следва, и тестът на архива проверява, че такъв файл не влиза.
- **`readme.test.ts` проверява и `npm install`** (D5): секцията „Install and
  test“ в README започва с него и е първата команда, която читателят
  изпълнява.
- **Секцията „Demo“ в README дава `curl` без `-H content-type`** (D3), за да
  се съберат шестте команди на по един ред; пълната форма с header-а е в
  секцията „HTTP“ по-горе. Адаптерът не гледа header-а, затова и двете
  работят.
- **Тестът на архива ползва собствен ustar четец + ръчна проверка с OS
  `tar`** (D5) — изпълнено при apply: `tar -tzf` чете архива, `tar -xzf` в
  temp папка + `npm install && npm test` дава 156/156. Нищо в
  `src/` не е променено.
