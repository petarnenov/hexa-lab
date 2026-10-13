# Proposal

## Why

Хексагонът е завършен и работи (STORY-1.1–1.8): `npm run cli` и `npm run http`
дават `total: 14239.73` за `hh-1` Q1 2026 с memory и json storage. Но проектът
няма `README.md` — единственото обяснение *защо* папките са такива живее в
коментарите на кода и в `openspec/specs/`, които обучаващият се още не знае
къде да търси. STORY-1.9 затваря EPIC-1: README, което свързва теорията
(хексагон, портове, адаптери) с конкретните папки и команди; финално демо,
което показва смяната на адаптерите с една env променлива; и доставка на
проекта като архив `hexa/` без `node_modules`.

## What Changes

- Нов `README.md` (на английски — както кодът и коментарите; решение на
  потребителя при propose) с три секции по заданието:
  1. **The hexagon** — ASCII диаграма на хексагона, в която всяка кутия носи
     реалната папка/файл (`src/domain/`, `src/application/ports/in|out/`,
     `src/adapters/in/`, `src/adapters/out/`, `src/bootstrap/`), плюс
     правилото за зависимостите и кой тест го пази.
  2. **Running it** — `npm install`, `npm test`, `npm run typecheck`,
     `npm run cli -- hh-1 2026-01-01 2026-03-31 [--json]`, `npm run http` +
     `curl` (успех и 404), смяна на storage със `STORAGE=memory|json`,
     `DATA_DIR`, `PORT`; очакваният изход с `14239.73`, както реално го
     печата кодът.
  3. **Exercises** — петте упражнения от EPIC-2 (SQLite адаптер, MCP driving
     адаптер, порт `Clock`, use case `preview fees`, счупи правилото за
     зависимостите) с подсказка и линк към `backlog/EPIC-2-exercises/`;
     само описания, без код.
  Плюс кратък указател към `backlog/` и `openspec/` като „как се работи“.
- Нов `test/readme.test.ts` — README-то е част от доставката, затова се
  проверява като код: файлът съществува, споменава всяка от петте папки-слоеве,
  `test/architecture.test.ts`, петте npm команди, трите env променливи,
  `14239.73`, `HOUSEHOLD_NOT_FOUND` и точно пет упражнения с линкове към
  `STORY-2.x`.
- Нов npm скрипт `pack` (`tsx scripts/pack-demo.ts`), който създава
  `hexa.tar.gz` в корена на repo-то: копие на проекта под префикс `hexa/`
  без `.git/`, `node_modules/`, архиви `*.tar.gz` и файловете от `.gitignore`.
  Чист Node (`node:fs`, `node:zlib`, ustar формат) — без `tar`/`git` в
  shell, за да важи правилото „скриптовете са преносими“ от
  `project-toolchain`. `hexa.tar.gz` влиза в `.gitignore`; `scripts/` влиза
  в `tsconfig.json` `include`, за да го покрива `npm run typecheck`.
- Нов тест за архива в `test/pack-demo.test.ts`: скриптът се пуска с изходен
  път в temp папка, архивът се чете обратно и се проверява, че всеки запис
  започва с `hexa/`, няма `node_modules/` и `.git/`, и че `README.md`,
  `package.json`, `src/bootstrap/compose.ts` и `data/accounts.json` са вътре.
- Финалното демо (SUB-1.9.2.1, SUB-1.9.2.2) не добавя код: при apply се
  пускат CLI с и без `STORAGE=json`, два HTTP сървъра (memory на 3000, json
  на 3001) с `curl` към всеки и 404 пример, и изходът се показва в нишката
  и се записва в README като очакван изход.

Покрити backlog ID-та: **STORY-1.9**; TASK-1.9.1 (SUB-1.9.1.1, SUB-1.9.1.2,
SUB-1.9.1.3); TASK-1.9.2 (SUB-1.9.2.1, SUB-1.9.2.2, SUB-1.9.2.3).

## Non-goals

- Имплементация на упражненията от EPIC-2 — README само ги описва; те остават
  `todo` в backlog-а.
- Промени в `src/` — хексагонът е готов; ако демото открие бъг, той е отделна
  поправка, не част от това story.
- Публикуване на архива някъде (GitHub release, npm) — доставката е локален
  файл `hexa.tar.gz`.
- Поддръжка на `.gitignore` като общ парсер — pack скриптът носи явен списък
  изключения, огледало на днешния `.gitignore`.
- Генериране на README от кода/спецовете; документацията е ръчна и се пази
  в синхрон от `test/readme.test.ts` и правилото „sync docs“.

## Capabilities

### New Capabilities
- `project-readme`: какво трябва да съдържа `README.md` — хексагон с реални
  папки, инструкции за стартиране и смяна на storage, очакван изход на
  демото, секция с упражнения — и че тест пази съдържанието.

### Modified Capabilities
- `project-toolchain`: ADDED изискване за скрипт `pack`, който създава
  `hexa.tar.gz` само със средствата на Node; MODIFIED изискването за
  `typecheck`, което вече покрива и `scripts/`.

## Impact

- Нови файлове: `README.md`, `scripts/pack-demo.ts`, `test/readme.test.ts`,
  `test/pack-demo.test.ts`.
- Променени: `package.json` (скрипт `pack`), `tsconfig.json` (`include` +
  `scripts`), `.gitignore` (`hexa.tar.gz`).
- `src/` и `data/` не се пипат. Няма нови зависимости (dev или runtime).
- `test/architecture.test.ts` не е засегнат — обхожда само `src/`.
- След това story EPIC-1 е завършен; CLAUDE.md вече изисква README да се
  обновява при всяко следващо story.
