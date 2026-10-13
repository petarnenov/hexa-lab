# Proposal

## Why

След STORY-3.2 UI-ят работи, но проектът не го „признава“: README няма секция
за него, диаграмата на хексагона показва само CLI и HTTP, демото е „same
total, four ways“, а CLAUDE.md и `openspec/config.yaml` твърдят „без runtime
зависимости“ без да кажат, че `ui/` е отделен пакет. `npm run pack` би
включил `ui/dist/`, ако някой е правил `vite build`. STORY-3.3 затваря
EPIC-3: документацията и доставката описват реалната структура и демото е
прието ръчно в браузър.

## What Changes

- **README.md**
  - Нова секция `### UI` под „Running it“: `cd ui && npm install`, два
    терминала (`npm run http` и `npm run ui`), `http://localhost:5173`,
    какво прави Vite proxy-то (`/households` → `localhost:3000`, без CORS в
    сървъра), `npm run ui:test`, `PORT` важи и за двете страни. Записва
    се и реалният начин за друг порт на Vite (`npm run ui -- -- --port`),
    открит в STORY-3.2.
  - ASCII диаграмата получава ред над driving адаптерите: `curl` и
    `browser (ui/)` като клиенти на `createHttpServer.ts`, извън хексагона,
    и `terminal` като клиент на `runCli.ts`. Таблицата на слоевете получава
    бележка, че `ui/` не е слой: отделен пакет, който не импортира `src/`.
  - Демото „same total, four ways“ става „five ways“ - петият е браузърът.
  - Инструкцията за доставка: `npm run pack` включва `ui/`; на другата
    страна `npm install && npm test && (cd ui && npm install && npm test)`.
- **test/readme.test.ts**: нов тест за UI-секцията - README споменава
  `cd ui && npm install`, `npm run ui`, `npm run ui:test`, `localhost:5173`
  и `ui/` в диаграмата.
- **scripts/pack-demo.ts**: `ui/dist/` се изключва от архива (огледално на
  `.gitignore`); `ui/node_modules/` вече е изключен от правилото за
  `node_modules`. `test/pack-demo.test.ts` проверява, че `hexa/ui/package.json`
  и `hexa/ui/src/App.tsx` са вътре, а под `hexa/ui/node_modules/` и
  `hexa/ui/dist/` няма записи.
- **CLAUDE.md**: структурата споменава `ui/` като отделен пакет (React +
  Vite, собствен `package.json`, говори със сървъра само по HTTP); правилото
  „не добавяй runtime зависимости“ се уточнява - важи за корена и `src/`,
  `ui/` има свои зависимости; работният цикъл добавя `cd ui && npm test`
  при промени в `ui/`.
- **openspec/config.yaml** (`context`): същото уточнение за `ui/` и за dev
  зависимостите на корена, за да го виждат следващите change-ове.
- **Ръчна приемка** в браузър, записана в design.md на този change: `hh-1`
  Q1 2026 → три реда и `14,239.73`; същото със `STORAGE=json`; `hh-404` →
  `HOUSEHOLD_NOT_FOUND`; `to < from` → `INVALID_BILLING_PERIOD`; спрян
  backend → `NETWORK_ERROR`; екранът на 375px без хоризонтален скрол.

## Покрити backlog елементи

- STORY-3.3 Интеграция и документация
  - TASK-3.3.1 README
    - SUB-3.3.1.1 Секция UI
    - SUB-3.3.1.2 Диаграма и правила
  - TASK-3.3.2 Демо и pack
    - SUB-3.3.2.1 pack включва ui/
    - SUB-3.3.2.2 Ръчна приемка

STORY-3.3 е последната история на EPIC-3. При archive, след като ръчната
приемка потвърди критериите на EPIC-3, и `EPIC-3.md` минава на `done`.

## Capabilities

### New Capabilities

Няма. Промените са документация, доставка и приемка на вече спецификирано
поведение; новите изисквания се добавят към съществуващите capability-та.

### Modified Capabilities

- `project-readme`: ново изискване „README описва UI-я“ (секция UI с
  командите и proxy-то); изискването за диаграмата се разширява -
  браузърът и `curl` са клиенти на HTTP адаптера извън хексагона, а `ui/`
  е назован като отделен пакет извън слоевете; изискването за демото
  включва браузъра като пети начин и инструкцията за доставка с `ui/`;
  изискването за теста на README добавя низовете на UI-секцията.
- `project-toolchain`: изискването за `npm run pack` се уточнява - архивът
  включва `ui/` без `ui/node_modules/` и `ui/dist/`, и „на другата страна“
  минават и UI тестовете след `cd ui && npm install`.
- `web-ui-toolchain`: изискването „Генерираните файлове на ui не влизат в
  git и в архива“ се разширява от `ui/node_modules/` до `ui/dist/` и за
  архива, с проверка в теста на pack.

## Non-goals

- Промени в `src/` или в `ui/src/`: нито сървърът, нито екранът се пипат.
  Ако приемката открие бъг, той се записва в design.md и става отделна
  задача/story, не се поправя „между другото“ тук.
- Production build на UI (`vite build`), сервиране на `ui/dist/` от HTTP
  адаптера, Docker, CI.
- Автоматизирани browser/e2e тестове (Playwright в repo-то): приемката е
  ръчна по условие на SUB-3.3.2.2.
- Промяна на `test/architecture.test.ts`: `ui/` е извън `src/`.
- Нови упражнения в EPIC-2 или README секцията „Exercises“.

## Impact

- Променени файлове: `README.md`, `CLAUDE.md`, `openspec/config.yaml`,
  `scripts/pack-demo.ts`, `test/readme.test.ts`, `test/pack-demo.test.ts`.
  Без нови файлове в `src/`, `ui/` или `test/`.
- Spec-ове: три MODIFIED capability-та (`project-readme`,
  `project-toolchain`, `web-ui-toolchain`), без нови.
- Зависимости: никакви - нито в корена, нито в `ui/`.
- `npm run typecheck && npm test` в корена: двата тестови файла растат с по
  един-два теста; `cd ui && npm test` не е засегнат.
- Backlog: STORY-3.3 и децата ѝ → `done`; EPIC-3 → `done` при archive.
