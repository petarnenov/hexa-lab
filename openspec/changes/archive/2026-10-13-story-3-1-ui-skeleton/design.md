# Design

## Context

Вж. proposal.md - Why. Състояние: коренът е ESM TS пакет без runtime
зависимости (`typescript`, `tsx`, `@types/node`), Node 24.21 / npm 11.19,
TypeScript 7.0. `.gitignore` вече има `node_modules/` (без водеща `/`, т.е.
важи на всяка дълбочина). `scripts/pack-demo.ts` изключва папки по име
(`node_modules`, `.git`), не по път. `test/architecture.test.ts` обхожда
само `src/`.

Налични версии към момента на планиране: vite 8.3, vitest 5.0, react 19.3,
@tanstack/react-query 5.104, @vitejs/plugin-react 6.1, jsdom 30,
@testing-library/react 16.3, jest-dom 7.0, user-event 14.6. Vite 8 иска
Node ≥ 20.19 / ≥ 22.12 - покрито.

Ограничения: CLAUDE.md „без runtime зависимости“ се чете като правило за
кореновия пакет (уточнява се в STORY-3.3); `ui/` не импортира `src/`;
`src/` не се пипа.

## Goals / Non-Goals

**Goals:**
- `ui/` пакет, който STORY-3.2 не трябва да преконфигурира: dev, test,
  typecheck, proxy, тема, тестова среда - всичко готово.
- Кореновите `npm run typecheck && npm test` остават непроменени като
  обхват и резултат.

**Non-Goals:**
- npm workspaces, споделен lockfile, build/deploy pipeline.
- Споделяне на типове между `src/` и `ui/`.

## Decisions

### D1. Отделен пакет + `npm --prefix ui`, не workspaces
Коренов `package.json`:
```json
"ui":      "npm --prefix ui run dev",
"ui:test": "npm --prefix ui test"
```
- Workspaces биха hoist-нали `react` в кореновия `node_modules/` и биха го
  вкарали в кореновия lockfile - размива правилото „коренът няма
  зависимости“ и чупи spec-а `project-toolchain` (сценарий „Инсталация на
  чист checkout“). Отделен пакет държи границата видима: две `npm install`,
  два lockfile-а.
- `--prefix` е npm, преносимо macOS/Linux, без `cd &&`.
- Аргументи: `npm run ui -- --port 5174` стигат до vite.

### D2. Версии: най-новите major-и, caret диапазони
`vite ^8`, `vitest ^5`, `react ^19`, `@tanstack/react-query ^5`,
`@vitejs/plugin-react ^6`, `jsdom ^30`, `typescript ^7`, `@testing-library/react ^16`,
`@testing-library/jest-dom ^7`, `@testing-library/user-event ^14`, `@types/react ^19`,
`@types/react-dom ^19`. `ui/package-lock.json` се комитва.
- Учебен проект: учим на актуалния стек. Планираният fallback към
  `typescript ^5.9`, ако tsgo не се разбира с JSX/`vite/client`, не беше
  нужен: при apply `typescript@7.0.2` мина typecheck на `.tsx` и
  `vite.config.ts` без проблем.

### D3. Един `vite.config.ts` за Vite и Vitest
```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { "/households": `http://localhost:${process.env.PORT || 3000}` },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.tsx"],
  },
});
```
- `defineConfig` от `vitest/config` типизира и `test` блока; отделен
  `vitest.config.ts` би дублирал plugin-а.
- Proxy без `rewrite` и без `changeOrigin`: пътят е същият на двете страни,
  HTTP адаптерът не гледа `Host`.
- `PORT` се чете по същия начин като в `http.main.ts` (`||`, за да е празен
  string = „не е зададен“).
- `globals: false` (по подразбиране): тестовете импортират `test`/`expect`
  от `vitest` явно, както кореновите от `node:test`. Отклонение от
  SUB-3.1.1.3, която споменава `types: ["vitest/globals"]` - не са нужни.

### D4. `ui/tsconfig.json`
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noEmit": true,
    "verbatimModuleSyntax": true,
    "noUncheckedIndexedAccess": true,
    "types": ["vite/client"],
    "skipLibCheck": true
  },
  "include": ["src", "vite.config.ts"]
}
```
- `bundler` резолюция, защото Vite, не Node, резолва модулите; import-ите са
  без разширение (`./App`), не `./App.tsx` като в `src/`. Разликата е
  умишлена и видима: друг runtime, друг конфиг.
- `vite.config.ts` е в `include`, за да се проверява и той; `vitest/config`
  носи типовете на `test`. jest-dom матчърите се типизират чрез
  `import "@testing-library/jest-dom/vitest"` в setup файла (augment-ва
  `expect`), без `types` запис.
- Кореновият `tsconfig.json` има `include: ["src","test","scripts"]` - `ui/`
  е извън него без промяна.

### D5. Тема: CSS променливи, `color-scheme: dark`, без библиотека
`ui/src/styles.css`, импортиран от `main.tsx`:
```css
:root {
  color-scheme: dark;
  --bg: #0f1115; --surface: #171a21; --border: #2a2f3a;
  --text: #e6e8ee; --muted: #9aa3b2; --accent: #7dd3c0; --danger: #f87171;
  --radius: 8px; --space-1: 4px; --space-2: 8px; --space-3: 16px; --space-4: 24px;
  --font: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
}
body { margin: 0; background: var(--bg); color: var(--text); font-family: var(--font); }
.shell { max-width: 720px; margin: 0 auto; padding: var(--space-4) var(--space-3) var(--space-5); }
```
- Отклонение от първоначалния план (`main { max-width }`): колоната е
  `.shell` div, който обхваща и header-а, и `main`. Иначе header-ът щеше да
  е на пълна ширина и да не се подравнява със съдържанието. Добавени са и
  `--space-5`, `--font-mono` (за `h1`) и `* { box-sizing: border-box }`.
- Контраст, изчислен при apply и записан в коментар в `styles.css`:
  `--text` 15.4:1 / 14.2:1, `--muted` 7.4:1 / 6.8:1 (върху `--bg` /
  `--surface`), `--accent` 10.8:1, `--danger` 6.8:1 върху `--bg`.
  `tabular-nums` се добавя на `td`/числата в STORY-3.2.
- Проверено с Playwright: 375px - без хоризонтален скрол, 16px отстъп;
  1440px - `.shell` е 720px, центриран (360px от двете страни).
- `color-scheme: dark` на `:root` + `<meta name="color-scheme" content="dark">`
  в `index.html`: тъмен native date picker и без бял flash преди CSS-а.
- Без Tailwind/UI библиотека: един екран, ~60 реда CSS; библиотека би
  скрила какво прави темата.

### D6. App shell и QueryClient
`main.tsx` създава един `QueryClient` и рендерира `<App/>` в
`QueryClientProvider` + `StrictMode`. `App.tsx`: `<header>` с `<h1>hexa-lab</h1>`
и `<p>Household fees</p>`, `<main>` празен. React Query влиза тук, а не в
STORY-3.2, за да е provider-ът готов и `renderWithQuery` да е тестван.
`index.html` няма favicon - браузърът логва 404 за `/favicon.ico`; безвредно,
остава извън обхвата (не е в backlog-а).

### D7. Тестова среда
`ui/src/test/setup.ts`:
```ts
import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
afterEach(cleanup);
```
`ui/src/test/render.tsx`: `renderWithQuery(ui)` - нов `QueryClient` с
`defaultOptions: { queries: { retry: false }, mutations: { retry: false } }`
на всеки render, за да няма споделен кеш между тестове. Помощникът е
отделен от setup, защото setup е side-effect файл, а помощникът се импортира.

`App.test.tsx`: `renderWithQuery(<App/>)`; `getByRole("heading", { level: 1, name: "hexa-lab" })`
и `getByText("Household fees")`.

### D8. Скриптове на `ui/package.json`
```json
"dev": "vite", "build": "vite build", "preview": "vite preview",
"test": "vitest run", "typecheck": "tsc --noEmit"
```
`vitest run`, не `vitest`: еднократно, за `npm run ui:test` и CI;
watch е `npx vitest` ръчно.

### D9. `.gitignore` и pack
Добавя се само `ui/dist/`. `ui/node_modules/` вече е покрито от
`node_modules/`. `pack-demo.ts` изключва `node_modules` по име на всяка
дълбочина, затова `ui/node_modules` не влиза в архива без промяна;
`ui/dist` в архива е грижа на STORY-3.3 (SUB-3.3.2.1).

## Risks / Trade-offs

- [TypeScript 7 + JSX/`vite/client` несъвместимост] → fallback `typescript ^5.9`
  само в `ui/`; записва се в D2.
- [Vite 8 / Vitest 5 са нови major-и с непознати за мен breaking changes] →
  при apply се четат `npx vite --version` изход и грешките буквално;
  конфигурацията е минимална, за да има малко повърхност.
- [Два `npm install` в проекта] → README в STORY-3.3 го казва явно; smoke
  сценарият „Инсталация на ui“ го покрива.
- [`PORT` се чете при старт на Vite, не при всяка заявка] → документирано
  в spec сценария „Друг порт“: `PORT=3001 npm run ui`.
- [`ui/` без lint] → non-goal; коренът също няма.
