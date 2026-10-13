# Proposal

## Why

Хексагонът е завършен откъм части: use case (STORY-1.4), два driven адаптера
за storage плюс console publisher (STORY-1.6) и два driving адаптера — HTTP и
CLI (STORY-1.7). Но никой не ги свързва: `npm run cli` и `npm run http` сочат
към `src/bootstrap/*.main.ts`, които не съществуват, а единственото място,
където конкретен адаптер се среща с порт, са тестовете. Учебната теза на
STORY-1.8 е composition root-ът: **едно** място, което знае всички конкретни
класове, избира storage по `STORAGE` и връща готов use case — така че смяната
на memory ↔ json е промяна на една env променлива, не на код. Без него
демото в STORY-1.9 („total 14239.73 през CLI и HTTP, с memory и json“) не
може да се изпълни.

## What Changes

- Нов `src/bootstrap/compose.ts` с `composeApp(env, stderr)`, който връща
  стойност от типа на inbound порта `CalculateHouseholdFees` (не класа на
  сервиза): по `env.STORAGE` (`memory` по подразбиране, или `json`) избира
  двойката репозитории, винаги използва `ConsoleFeeReportPublisher` към
  подадения stderr и сглобява `CalculateHouseholdFeesService`. При друга
  стойност на `STORAGE` хвърля грешка, която назовава получената стойност и
  позволените. На stderr пише един ред `[bootstrap] STORAGE=<стойност>`.
- Пътят до `data/` се извежда от `import.meta.url` на `compose.ts`
  (`../../data`), така че `npm run http` работи от всяка работна директория;
  `env.DATA_DIR` го презаписва. JSON режимът чете `accounts.json` и
  `fee-schedules.json` от тази папка.
- Нов `src/bootstrap/seed.ts` със `seedAccounts` и `seedFeeSchedules` — същите
  данни като `data/*.json`, за memory режима. Тест пази двете в синхрон.
- Нов `src/bootstrap/cli.main.ts`: `process.exitCode = await runCli(composeApp(), process.argv.slice(2))`.
- Нов `src/bootstrap/http.main.ts`: `createHttpServer(composeApp()).listen(PORT)`
  с `PORT` по подразбиране `3000`; след `listening` пише на stderr
  `[bootstrap] listening on http://localhost:<реален порт>` (реален, защото
  `PORT=0` дава ефимерен порт — така тестът може да го вдигне без конфликт).
- Нов `test/bootstrap.test.ts`: `composeApp` с memory и json дава един и същ
  отчет за `hh-1` Q1 2026 (`total 14239.73`); `DATA_DIR` се уважава; невалиден
  `STORAGE` хвърля; `seed.ts` съвпада с `data/*.json`; двата entry point-а се
  пускат като дъщерни процеси (`node --import tsx`) и дават `total 14239.73`
  през CLI `--json` и през HTTP, с `STORAGE=memory` и `STORAGE=json`.
- `src/bootstrap/` е единственият слой, който импортира конкретни адаптери —
  вече enforce-нато от `test/architecture.test.ts`; новите файлове минават
  през него.

### Non-goals

- Нов storage (SQLite е EPIC-2 / STORY-2.1); DI контейнер; конфигурационен
  файл; валидация на `PORT` отвъд `Number(...)`.
- Graceful shutdown на HTTP сървъра, сигнали, health endpoint.
- README (STORY-1.9) и промяна на `package.json` скриптовете — те вече сочат
  правилните файлове.
- Промяна на адаптерите или use case-а; промяна на `data/*.json`.

## Покрити backlog елементи

- STORY-1.8 Bootstrap: composition root
  - TASK-1.8.1 compose.ts: SUB-1.8.1.1 (избор по STORAGE), SUB-1.8.1.2 (път
    до data/), SUB-1.8.1.3 (seed.ts)
  - TASK-1.8.2 Entry points: SUB-1.8.2.1 (cli.main.ts), SUB-1.8.2.2 (http.main.ts)

## Capabilities

### New Capabilities
- `composition-root`: как се сглобява use case-ът от конкретни адаптери —
  избор на storage по `STORAGE`, местоположение на данните (`DATA_DIR`),
  seed данни за memory режима, лог ред и грешка при непозната стойност.
- `entry-points`: поведението на стартовите файлове за CLI и HTTP —
  аргументи и exit код от процеса, `PORT` и лог ред при слушане, грешка при
  невалидна конфигурация.

### Modified Capabilities
- (няма) — `project-toolchain` вече описва, че `npm run cli`/`npm run http`
  стартират `src/bootstrap/*.main.ts`; тази промяна ги прави съществуващи, без
  да сменя изискването. `architecture-dependency-rule` вече позволява
  `bootstrap → всичко`.

## Impact

- Нови файлове: `src/bootstrap/compose.ts`, `src/bootstrap/seed.ts`,
  `src/bootstrap/cli.main.ts`, `src/bootstrap/http.main.ts`,
  `test/bootstrap.test.ts`.
- `npm run cli -- hh-1 2026-01-01 2026-03-31` и `npm run http` стават
  работещи команди; `STORAGE`, `DATA_DIR`, `PORT` са единствените env
  променливи, които проектът чете, и само bootstrap ги чете.
- Няма промяна по domain/application/adapters; няма нови зависимости.
- Тестовете пускат дъщерни процеси с `tsx` — `npm test` става с ~1–2 s
  по-бавен.
