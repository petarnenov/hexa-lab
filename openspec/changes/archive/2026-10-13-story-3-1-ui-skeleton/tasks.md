# Tasks

## 1. TASK-3.1.1 Vite проект

- [x] 1.1 (SUB-3.1.1.1) Създай `ui/package.json` (`private`, `"type": "module"`, скриптове по design D8, зависимости по D2) и `ui/index.html` с `<meta name="color-scheme" content="dark">` и `<script type="module" src="/src/main.tsx">`; изпълни `cd ui && npm install` и провери, че `ui/package-lock.json` е създаден, а кореновият `package.json` няма `dependencies`.
- [x] 1.2 (SUB-3.1.1.2) Създай `ui/vite.config.ts` по design D3; при работещ `npm run http` провери през `cd ui && npm run dev` и `curl -s -X POST localhost:5173/households/hh-1/fees -d '{"from":"2026-01-01","to":"2026-03-31"}'`, че отговорът съдържа `"total":14239.73`; със спрян backend проверете, че curl получава 5xx, а dev сървърът продължава.
- [x] 1.3 (SUB-3.1.1.3) Създай `ui/tsconfig.json` по design D4 и минимален `ui/src/main.tsx` (`createRoot` + празен `<App/>` placeholder); провери, че `cd ui && npm run typecheck` минава с код 0; ако `typescript@7` гърми върху JSX/`vite/client`, премини на `^5.9` само в `ui/` и запиши отклонението в design D2.
- [x] 1.4 (SUB-3.1.1.3) Добави `ui/dist/` в `.gitignore` без да пипаш съществуващите редове; провери с `git status --porcelain`, че `ui/node_modules/` не се показва, а `ui/package-lock.json` е untracked (ще се комитва).
- [x] 1.5 (SUB-3.1.1.1) Добави `ui` и `ui:test` в кореновия `package.json` по design D1; провери, че `npm run ui` стартира Vite от корена и че `npm run` изброява двата скрипта.
- [x] 1.6 Негативен случай: временно сложи `const n: number = "x"` в `ui/src/main.tsx`, увери се, че `cd ui && npm run typecheck` пада, а кореновият `npm run typecheck` минава; махни го.
- [x] 1.7 `npm run typecheck && npm test` минават (корен).

## 2. TASK-3.1.2 Тъмна тема и App shell

- [x] 2.1 (SUB-3.1.2.1) Създай `ui/src/styles.css` по design D5 с всички цветове като `:root` променливи и `color-scheme: dark`; провери с `grep -nE '#[0-9a-f]{3,6}' ui/src/*.css ui/src/*.tsx`, че hex стойности има само в `:root`; провери контраст `--text`/`--muted` върху `--bg`/`--surface` ≥ 4.5:1 (ръчно изчисление или онлайн инструмент, запиши стойностите в design D5).
- [x] 2.2 (SUB-3.1.2.2) Напиши `ui/src/App.tsx` (header с `<h1>hexa-lab</h1>`, `<p>Household fees</p>`, празен `<main>`) и довърши `ui/src/main.tsx` по design D6 (`StrictMode`, `QueryClientProvider`, импорт на `styles.css`); провери в браузър на `npm run ui`, че страницата е тъмна и header-ът се вижда.
- [x] 2.3 Провери responsive: в DevTools на 375px няма хоризонтален скрол и има 16px отстъп; на 1440px `main` е центриран и ≤ 720px.
- [x] 2.4 `cd ui && npm run typecheck` и кореновите `npm run typecheck && npm test` минават.

## 3. TASK-3.1.3 Vitest

- [x] 3.1 (SUB-3.1.3.1) Създай `ui/src/test/setup.ts` и `ui/src/test/render.tsx` по design D7; провери, че `cd ui && npm test` стартира Vitest без грешка в конфигурацията (0 тестове е ок на тази стъпка).
- [x] 3.2 (SUB-3.1.3.2) Напиши `ui/src/App.test.tsx` (heading ниво 1 „hexa-lab“, текст „Household fees“) с `renderWithQuery`; провери, че `cd ui && npm test` отчита 1 успешен тест и че `npm run ui:test` от корена дава същия резултат.
- [x] 3.3 Негативен случай: временно смени очаквания текст на „hexa-lab2“, увери се, че `cd ui && npm test` пада с ненулев код и името на теста; върни го.
- [x] 3.4 Провери, че кореновият `npm test` не изпълнява UI тестовете (броят тестове е същият като преди change-а) и че `npm run pack && tar -tzf hexa.tar.gz | grep 'ui/'` показва `hexa/ui/package.json` и нито един ред с `ui/node_modules/`.
- [x] 3.5 Sync docs: прегледай proposal.md, design.md и трите delta spec-а срещу реално написаното (версии, файлове, конфиг) и поправи отклоненията с причина в design.md.
- [x] 3.6 `cd ui && npm run typecheck && npm test` и кореновите `npm run typecheck && npm test` минават.

## Workflow follow-up

- `/opsx:archive story-3-1-ui-skeleton` - сменя status на STORY-3.1, TASK-3.1.x и SUB-3.1.x.y на `done`.
- `/commit`, после `/clear`.
