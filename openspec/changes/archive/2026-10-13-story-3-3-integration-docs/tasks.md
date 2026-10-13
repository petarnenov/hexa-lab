# Tasks

## 0. Старт

- [x] 0.1 Смени `status: todo` → `status: in-progress` във frontmatter на `backlog/EPIC-3-web-ui/STORY-3.3-integration-docs/STORY-3.3.md`; провери с `grep -rl '^status: in-progress' backlog`, че е само това story.

## 1. TASK-3.3.1 README

- [x] 1.1 (SUB-3.3.1.1) Тест преди код: в `test/readme.test.ts` добави теста от design D2 (`cd ui && npm install`, `npm run ui`, `npm run ui:test`, `localhost:5173`); провери, че `npm test` пада само с този тест и съобщението казва кой низ липсва.
- [x] 1.2 (SUB-3.3.1.1) Добави `### UI` в README между `### HTTP` и `### Switching storage` по design D1 (install, два терминала, 5173, proxy и `PORT`, друг порт на Vite с `-- --`, `npm run ui:test`, „не импортира `src/`“); уточни увода („no runtime dependencies“ → в хексагона; `ui/` е отделен пакет). Провери: `npm test` минава; при работещи `npm run http` и `npm run ui` всяка команда от секцията, изпълнена както е написана, дава описаното (вкл. `npm run ui -- -- --port 5174` реално отваря Vite на 5174 с работещо proxy).
- [x] 1.3 (SUB-3.3.1.1) Преименувай демото на „Demo: same total, five ways“, добави браузъра като пета стъпка и изречението за `14,239.73` по design D1; обнови абзаца за доставката (`npm run pack` включва `ui/`; `cd hexa && npm install && npm test && (cd ui && npm install && npm test)`). Провери с `grep -c "14239.73" README.md`, че низът без запетая е още там, и `npm test` минава.
- [x] 1.4 (SUB-3.3.1.2) В ASCII диаграмата добави реда с клиентите извън хексагона (`terminal`, `curl · browser (ui/)`) над „driving (in) adapters“ по design D1, без да местиш кутиите; добави абзаца след таблицата на слоевете, че `ui/` не е слой. Провери: `grep -n "browser (ui/)" README.md` намира реда, колоните на стрелките съвпадат с кутиите под тях (визуално в monospace), `npm test` минава.
- [x] 1.5 (SUB-3.3.1.2) Обнови `CLAUDE.md` по design D5: увод, нов ред за `ui/` в „Правила“, правилото за зависимостите само за корена, стъпка 3 с `cd ui && npm run typecheck && npm test` при промени в `ui/`. Провери: `grep -n "ui/" CLAUDE.md` показва трите места и документът описва структурата, която `ls` показва.
- [x] 1.6 (SUB-3.3.1.2) Обнови `openspec/config.yaml` `context` и `operations.apply.guidance` по design D5. Провери: `openspec instructions proposal --change story-3-3-integration-docs --json | grep -c 'ui/'` връща > 0 (контекстът се парсва и съдържа уточнението) и `openspec validate story-3-3-integration-docs --strict` минава.
- [x] 1.7 `npm run typecheck && npm test` минават.

## 2. TASK-3.3.2 Демо и pack

- [x] 2.1 (SUB-3.3.2.1) Тест преди код: в `test/pack-demo.test.ts` добави `hexa/ui/package.json`, `hexa/ui/package-lock.json`, `hexa/ui/vite.config.ts`, `hexa/ui/src/App.tsx` към очакваните файлове, новия тест „ui/node_modules and ui/dist are not in the archive“ и маркера `ui/dist/.pack-test` (създаван преди `pack`, чистен в `after`, папката се трие само ако тестът я е създал) по design D4. Провери, че `npm test` пада точно с теста за `ui/dist/` и минава за `ui/node_modules/`.
- [x] 2.2 (SUB-3.3.2.1) В `scripts/pack-demo.ts` добави `EXCLUDED_PATHS = new Set(["ui/dist"])` и проверката по repo-относителен път в `walk` по design D3; допълни коментара „mirrors .gitignore“. Провери: `npm test` минава; `npm run pack && tar -tzf hexa.tar.gz | grep '^hexa/ui/' | grep -vc 'node_modules\|dist'` показва файловете на `ui/`, а `tar -tzf hexa.tar.gz | grep -c 'ui/node_modules\|ui/dist'` дава 0; `git status --porcelain` не показва `ui/dist/`.
- [x] 2.3 (SUB-3.3.2.1) Проверка на доставката от другата страна: в temp папка `tar -xzf hexa.tar.gz && cd hexa && npm install && npm test && (cd ui && npm install && npm test)` минава; изтрий temp папката и `hexa.tar.gz` от корена след това.
- [x] 2.4 (SUB-3.3.2.2) Ръчна приемка по design D6, редове 1-5: `npm run http` + `npm run ui`, в браузър (DevTools/Playwright MCP или ръчно) `hh-1` → 3 реда и `14,239.73`; backend със `STORAGE=json` → същото; `hh-404` → `HOUSEHOLD_NOT_FOUND`; `to < from` → `INVALID_BILLING_PERIOD`; спрян backend → `NETWORK_ERROR`, Vite продължава. Запиши всеки резултат („OK“ или какво е различно) в секцията „Приемка“ на `design.md`.
- [x] 2.5 (SUB-3.3.2.2) Ръчна приемка ред 6: viewport 375×667, Calculate с defaults - формата в една колона, таблицата се чете, `document.documentElement.scrollWidth === 375`; запиши в „Приемка“. Ако някой ред от 2.4/2.5 не е OK: не поправяй в този change, запиши го в design.md и създай backlog елемент.
- [x] 2.6 `npm run typecheck && npm test` минават; `cd ui && npm run typecheck && npm test` минават (нищо в `ui/` не е променено, но приемката ги изисква).

## 3. Sync docs

- [x] 3.1 Прегледай `proposal.md`, `design.md` и трите delta spec-а срещу реално написаното (README формулировки, имената на тестовете, `EXCLUDED_PATHS`, съдържанието на CLAUDE.md/config.yaml); всяко отклонение се поправя в артефакта, а сменено решение се записва в design.md с едно изречение защо. Провери: секцията „Приемка“ в design.md е попълнена, `openspec validate story-3-3-integration-docs --strict` минава, `npm run typecheck && npm test` минават.

## Workflow follow-up

- `/opsx:archive`: мърджва трите delta spec-а в `openspec/specs/`, сменя `status: done` на STORY-3.3, TASK-3.3.1/3.3.2, SUB-3.3.1.1/3.3.1.2/3.3.2.1/3.3.2.2 **и на EPIC-3** (design D7).
- `/commit`, после `/clear`.
