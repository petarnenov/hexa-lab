# Proposal

## Why

EPIC-1 завърши с два driving адаптера (CLI, HTTP), но никой от тях не се
вижда в браузър. EPIC-3 добавя трети клиент - малък React UI в тъмна тема -
и STORY-3.1 е основата му: отделен `ui/` пакет с Vite, Vitest и тема, върху
който STORY-3.2 слага формата и отчета. Без тази основа няма къде да се
тества и покаже екранът.

## What Changes

- Нов пакет `ui/` със собствен `package.json`, `package-lock.json`,
  `vite.config.ts`, `tsconfig.json`, `index.html` и `src/`. Зависимости:
  `react`, `react-dom`, `@tanstack/react-query`; dev: `vite`,
  `@vitejs/plugin-react`, `typescript`, `vitest`, `jsdom`,
  `@testing-library/*`, `@types/react*`. Коренът остава без runtime зависимости.
- Vite dev сървър с proxy `/households` → `http://localhost:3000` (портът от
  `PORT`), така че браузърът говори със same-origin и HTTP адаптерът не получава CORS.
- Тъмна тема само: CSS променливи в `ui/src/styles.css`, `color-scheme: dark`,
  без UI библиотека. `App` с header „hexa-lab / Household fees“ и празен `main`,
  увит в `QueryClientProvider`.
- Vitest + Testing Library: `ui/src/test/setup.ts` (jest-dom, cleanup,
  `renderWithQuery`), `App.test.tsx` smoke тест.
- Кореновият `package.json` получава скриптове `ui` и `ui:test`, които
  делегират към `ui/` през `npm --prefix ui`. Кореновият `tsconfig.json` не
  включва `ui/`; `.gitignore` получава `ui/dist/`.

## Покрити backlog елементи

- STORY-3.1 Скелет на UI
  - TASK-3.1.1 Vite проект
    - SUB-3.1.1.1 package.json и скриптове
    - SUB-3.1.1.2 vite.config.ts с proxy
    - SUB-3.1.1.3 tsconfig.json и .gitignore
  - TASK-3.1.2 Тъмна тема и App shell
    - SUB-3.1.2.1 Design tokens
    - SUB-3.1.2.2 App shell
  - TASK-3.1.3 Vitest
    - SUB-3.1.3.1 Setup файл
    - SUB-3.1.3.2 Smoke тест на App

## Capabilities

### New Capabilities

- `web-ui-toolchain`: наблюдаемото поведение на `ui/` пакета - как се
  стартира dev сървърът, как се proxy-ват заявките към HTTP адаптера, как се
  пускат тестовете и typecheck-ът, и ограничението, че `ui/` не зависи от `src/`.
- `web-ui-shell`: какво вижда потребителят, когато отвори UI-я без да е
  направил нищо - тъмна тема, header, четимост на телефон и desktop.

### Modified Capabilities

- `project-toolchain`: добавя се изискване за кореновите скриптове `ui` и
  `ui:test`, които делегират към `ui/`, и се уточнява, че правилото „без
  runtime зависимости“ важи за кореновия пакет, а не за `ui/`.

## Non-goals

- Формата, API клиентът, отчетът и състоянията loading/error - STORY-3.2.
- README, диаграма, CLAUDE.md/config уточнения, pack на `ui/dist` и ръчна
  приемка - STORY-3.3. (`ui/node_modules` вече се изключва от `npm run pack`,
  защото скриптът филтрира по име на папка.)
- Светла тема, превключвател на тема, UI библиотека, Tailwind, ESLint/Prettier
  в `ui/`, production build pipeline, CI.
- Промени в `src/`: HTTP адаптерът не получава CORS, нито нов маршрут.

## Impact

- Нова папка `ui/` (~12 файла) с отделен `node_modules/` и lockfile.
- Кореновият `package.json`: два нови скрипта, нула нови зависимости.
- `.gitignore`: `ui/dist/`. `ui/node_modules/` вече е покрито от `node_modules/`.
- `test/architecture.test.ts` не се променя - обхожда само `src/`.
- Spec `project-toolchain` получава ново изискване (ADDED), без промяна на
  съществуващите.
