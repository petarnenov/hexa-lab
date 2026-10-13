# Design

## Context

Вж. proposal.md - Why. Състояние след STORY-3.2:

- `README.md` (STORY-1.9): секции „The hexagon“ (ASCII диаграма + таблица
  на слоевете), „Running it“ (Install and test / CLI / HTTP / Switching
  storage / Demo: same total, four ways), „Exercises“, „How this repo is
  worked on“ (с `npm run pack`). `test/readme.test.ts` проверява само низове,
  не заглавия и ред.
- `scripts/pack-demo.ts`: собствен ustar writer; `EXCLUDED_DIRS = {".git",
  "node_modules"}` се прилага по *име* на всяко ниво, затова
  `ui/node_modules/` вече е извън архива. `ui/dist/` не е изключен -
  `.gitignore` го има (`ui/dist/`), а коментарът в скрипта казва „mirrors
  .gitignore - when one changes, change the other“. `test/pack-demo.test.ts`
  пуска скрипта като child process към temp папка и чете архива обратно.
- Коренът има скриптове `ui` (`npm --prefix ui run dev`) и `ui:test`.
  Известен от STORY-3.2: `npm run ui -- --port 5174` не стига до Vite
  (вложеният npm изяжда `--port`); работи `npm run ui -- -- --port 5174`
  или `cd ui && npm run dev -- --port 5174`.
- `ui/vite.config.ts`: proxy `/households` → `http://localhost:${PORT || 3000}`,
  четен веднъж при старт. UI defaults: `hh-1`, `2026-01-01`, `2026-03-31`.
  Грешките в UI-я: `ApiError.code` = `error` от JSON тялото или
  `NETWORK_ERROR` (не-JSON отговор, вкл. 5xx HTML от proxy-то при спрян
  backend, или reject-нат `fetch`).
- `CLAUDE.md` и `openspec/config.yaml` описват слоевете в `src/` и „без
  runtime зависимости“ без да споменават `ui/`.

Ограничения: `src/` и `ui/src/` не се пипат; без нови зависимости;
скриптовете остават само `node` + dev зависимости (без `tar`).

## Goals / Non-Goals

**Goals:**
- Всеки документ описва реалната структура, включително `ui/`; низовете,
  които README трябва да има, са заковани в `readme.test.ts`.
- `npm run pack` дава архив, от който другата страна пуска и UI тестовете,
  без да носи `ui/dist/`; поведението е в `pack-demo.test.ts`.
- Ръчната приемка е възпроизводима стъпка по стъпка и резултатът ѝ е
  записан тук (секция „Приемка“), не само в главата на проверяващия.

**Non-Goals:**
- Преструктуриране на README (ред на секции, стил); само добавки и
  поправки на фактите.
- Промяна на формата на архива или на tar writer-а.

## Decisions

### D1. README: къде влиза UI-ят
- **`### UI`** се добавя в „Running it“ след `### HTTP` и преди
  `### Switching storage` (UI-ят е третата врата; storage-ът е ортогонален и
  важи за всички врати). Съдържание, в този ред:
  1. `cd ui && npm install` (еднократно; коренният `npm install` не го прави,
     защото `ui/` е отделен пакет със собствен lockfile).
  2. Два терминала: `npm run http` и `npm run ui`; адрес
     `http://localhost:5173`; формата идва попълнена с `hh-1` / Q1 2026,
     „Calculate“ показва трите реда и `14,239.73`.
  3. Proxy-то: страницата вика `/households/...` на своя origin, Vite го
     препраща към `localhost:3000`; затова `createHttpServer.ts` няма CORS
     и не знае за UI-я. `PORT=3001` трябва да се подаде и на двете команди
     (`PORT=3001 npm run http`, `PORT=3001 npm run ui`), защото Vite чете
     `PORT` веднъж при старт.
  4. Друг порт на Vite: `npm run ui -- -- --port 5174` (две `--`: едното за
     коренния npm, едното за вложения) или `cd ui && npm run dev -- --port 5174`.
  5. `npm run ui:test` (от корена) = `cd ui && npm test`; `cd ui && npm run typecheck`.
  6. Едно изречение: `ui/` не импортира нищо от `src/`, познава само JSON
     договора на HTTP адаптера; `test/architecture.test.ts` не го гледа.
- **Диаграмата**: над реда „driving (in) adapters“ се добавя ред с клиентите
  извън хексагона:
  ```
            terminal                  curl · browser (ui/)
               │                              │
               ▼                              ▼
                        driving (in) adapters
  ```
  Кутиите и всичко под тях остават както са. Алтернатива - кутия `ui/` вътре
  в диаграмата като трети driving адаптер - отхвърлена: UI-ят не имплементира
  порта, той е клиент на адаптера, точно като `curl`. Това е и поуката на
  EPIC-3.
- **Таблицата на слоевете** получава един абзац след нея: `ui/` не е ред в
  таблицата - отделен npm пакет извън `src/`, говори със сървъра само по
  HTTP, не импортира `src/`, и тестът за архитектурата не го обхожда.
- **Демото** се преименува на „Demo: same total, five ways“; към блока с
  команди се добавя стъпка „5. the browser“: при работещ `npm run http` на
  :3000 - `npm run ui`, отвори `http://localhost:5173`, натисни Calculate.
  Абзацът след блока казва, че таблицата в браузъра показва същите три
  fee-та и `14,239.73` (UI-ят форматира с разделители; числото е същото).
  Низът `14239.73` остава в README от CLI/curl примерите - `readme.test.ts`
  го търси точно така.
- **Доставка** („How this repo is worked on“): `npm run pack` включва `ui/`
  без `node_modules` и `dist`; командата на другата страна става
  `cd hexa && npm install && npm test && (cd ui && npm install && npm test)`.
- Уводът на README („no framework and no runtime dependencies“) получава
  уточнение „in the hexagon itself; the browser client in `ui/` is a
  separate package“ - иначе първото изречение противоречи на `ui/package.json`.

### D2. `readme.test.ts`: един нов тест за UI-секцията
```ts
test("gives the commands to install, run and test the UI", () => {
  mentions("cd ui && npm install", "npm run ui", "npm run ui:test", "localhost:5173");
});
```
- Същият стил като останалите: низове, не заглавия. `npm run ui` е подниз
  на `npm run ui:test`, затова и двата се проверяват отделно - ако някой
  махне стартовата команда, но остави тестовата, `npm run ui` пак ще мине;
  приемаме, защото тестът е предпазна мрежа срещу изтрита секция, не
  парсер на README. Диаграмата (`browser (ui/)`) не се проверява от тест -
  spec-ът за диаграмата и преди не беше проверяван на ниво ASCII.

### D3. `pack-demo.ts`: изключване по repo-относителен път, не по име
```ts
// Directories excluded wherever they appear.
const EXCLUDED_DIRS = new Set([".git", "node_modules"]);
// Directories excluded by repo-relative path - .gitignore lists them that way.
const EXCLUDED_PATHS = new Set(["ui/dist"]);
```
В `walk`, за директория: пропуска се, ако името е в `EXCLUDED_DIRS` **или**
repo-относителният път (posix) е в `EXCLUDED_PATHS`. Коментарът „mirrors
.gitignore“ остава и се допълва с `ui/dist`.
- Алтернатива: `"dist"` в `EXCLUDED_DIRS`. По-кратко, но изключва и
  евентуален бъдещ `dist/` на друго място, който `.gitignore` не изключва -
  огледалото престава да е огледало. `.gitignore` казва `ui/dist/`,
  скриптът казва същото.
- `ui/node_modules/` не се пипа: вече е покрит от правилото по име;
  тестът го закова изрично (D4).

### D4. `pack-demo.test.ts`: `ui/` вътре, `ui/node_modules` и `ui/dist` вън
- Към списъка „the project files are in the archive“ се добавят
  `hexa/ui/package.json`, `hexa/ui/package-lock.json`, `hexa/ui/vite.config.ts`,
  `hexa/ui/src/App.tsx`.
- Нов тест „ui/node_modules and ui/dist are not in the archive“:
  `names.filter(n => n.startsWith("hexa/ui/node_modules/") || n.startsWith("hexa/ui/dist/"))` е `[]`.
- За да е **реална** проверката за `ui/dist/`, тестът трябва да пакетира
  при съществуваща папка: в първия тест (този, който пуска скрипта) преди
  `pack(out)` се създава маркер `ui/dist/.pack-test` (`mkdir -p`), а в
  `after` се трие маркерът и - само ако папката е била създадена от теста -
  и папката. Така тестът не унищожава реален build, а при чист checkout не
  оставя следа. Алтернатива: да експортираме `walk` и да го тестваме като
  функция върху temp дърво - изисква скриптът да спре да изпълнява main при
  import (guard по `import.meta.url`), т.е. промяна на структурата му заради
  един тест; отхвърлено.
- При apply маркерът се създава в `before` hook на suite-а, а не вътре в
  първия тест: така подготовката е отделена от assert-ите и `after` има
  симетричен партньор; `createdUiDist` се помни между двата hook-а.
- `ui/node_modules/` присъства реално на машината на разработчика (след
  `cd ui && npm install`), така че тази половина на теста е реална без
  подготовка; при чист checkout без `ui/node_modules` тестът пак минава
  (нищо за изключване) - приемливо.

### D5. CLAUDE.md и `openspec/config.yaml`: едно и също уточнение на две места
- **CLAUDE.md**, „Правила“: „Слоеве в `src/`…“ остава; добавя се ред:
  „`ui/` е отделен npm пакет (React + Vite + Vitest) със собствен
  `package.json`; говори със сървъра само по HTTP през Vite proxy и не
  импортира `src/`. При промени в `ui/`: `cd ui && npm run typecheck && npm test`.“
  Правилото „Не добавяй runtime зависимости…“ става „…в корена (`src/`).
  Dev: само `typescript`, `tsx`, `@types/node`. `ui/` има свои зависимости.“
  В увода „Без framework-и и без runtime зависимости“ → „…в хексагона;
  UI-ят в `ui/` е отделен пакет.“ Стъпка 3 на цикъла („`/opsx:apply`“)
  получава „(и `cd ui && npm run typecheck && npm test`, ако change-ът пипа `ui/`)“.
- **`openspec/config.yaml`**, `context`: след реда за dev зависимостите -
  „`ui/` е отделен пакет (React + Vite + Vitest) със свои зависимости;
  правилото за `src/` не важи за него; `ui/` не импортира `src/`.“ Секцията
  `operations.apply.guidance` „Не добавяй runtime зависимости“ → „Не
  добавяй runtime зависимости в корена; в `ui/` - само с причина в design.md“.
- Двете места се поддържат отделно (CLAUDE.md го чете Claude Code при старт,
  `config.yaml` - OpenSpec при `instructions`); дублирането е съзнателно,
  както и досега за слоевете.

### D6. Ръчна приемка: процедура и запис
Проверява се в реален браузър (Chrome през DevTools MCP или Playwright MCP
при apply; ако GUI Chrome не тръгне от VS Code snap, вж. бележката в
паметта за `GSETTINGS_SCHEMA_DIR`). Стъпки:

| # | подготовка | действие | очаквано |
| --- | --- | --- | --- |
| 1 | `npm run http` (memory), `npm run ui` | отвори `localhost:5173`, Calculate с defaults | caption `hh-1 · 2026-01-01 → 2026-03-31`, 3 реда, Total `14,239.73` |
| 2 | рестарт на backend със `STORAGE=json` | Calculate отново | същите 3 реда и `14,239.73`; backend-ът логва `STORAGE=json` |
| 3 | - | Household `hh-404`, Calculate | alert с badge `HOUSEHOLD_NOT_FOUND`, `Household not found: hh-404` |
| 4 | - | From `2026-03-31`, To `2026-01-01`, Calculate | badge `INVALID_BILLING_PERIOD` |
| 5 | спри backend-а | Calculate с defaults | badge `NETWORK_ERROR`; Vite dev сървърът продължава |
| 6 | viewport 375×667 | стъпка 1 | формата в една колона, таблицата се чете, `document.documentElement.scrollWidth === 375` |

Резултатът се записва в секцията „Приемка“ по-долу при apply: за всеки ред
„OK“ или какво е различно. Разминаване = не се поправя в този change
(Non-goal); записва се и се отваря нов backlog елемент.

### D7. Backlog: EPIC-3 се затваря с този change
Приемката (D6) покрива четирите критерия на EPIC-3 (тестове минават, `hh-1`
дава `14 239.73`, `hh-404` показва кода без crash, тъмна тема на телефон и
desktop). При archive се сменя `status: done` на STORY-3.3, нейните TASK/SUB
и на `EPIC-3.md`.

## Risks / Trade-offs

- [README низовете в `readme.test.ts` са подниз един на друг] → приет
  trade-off (D2); тестът пази секцията, не формулировката.
- [`ui/dist/` маркерът остава, ако тестът бъде прекъснат със сигнал] →
  `after` се изпълнява и при fail; при SIGKILL остава празна папка
  `ui/dist/.pack-test`, която `.gitignore` крие и следващият `npm test`
  изчиства (или не създава, ако вече я има).
- [Vite избира 5174, ако 5173 е зает] → README казва „5173 по подразбиране;
  Vite печата реалния адрес“.
- [Приемка с `STORAGE=json` изисква рестарт на backend-а, не на Vite] →
  изрично в D6; proxy-то сочи порта, не процеса.
- [MCP браузър не е наличен при apply] → приемката се прави в ръчен Chrome
  и резултатът се описва с думи; скрийншот не е задължителен.

## Migration Plan

Няма - документация, скрипт и тестове. Rollback: `git revert`.

## Приемка

Изпълнена при apply на 2026-10-13 в Chrome (DevTools MCP), `npm run http`
на :3000 и `npm run ui` на :5173.

| # | случай | резултат |
| --- | --- | --- |
| 1 | memory, defaults (`hh-1`, Q1 2026) | OK - caption `hh-1 · 2026-01-01 → 2026-03-31`, 3 реда (Alpha 5,239.73 / Beta 616.44 / Gamma 8,383.56), Total `14,239.73` |
| 2 | backend рестартиран със `STORAGE=json`, Calculate | OK - същите 3 реда и `14,239.73`; backend логът показва `STORAGE=json` и `[publish] household hh-1` |
| 3 | `hh-404` | OK - alert с badge `HOUSEHOLD_NOT_FOUND`, „Household not found: hh-404“, без таблица |
| 4 | From `2026-03-31`, To `2026-01-01` | OK - badge `INVALID_BILLING_PERIOD`, „from (2026-03-31) must not be after to (2026-01-01)“ |
| 5 | спрян backend | OK - badge `NETWORK_ERROR`, „Server returned 502 without a JSON error body“; Vite продължава да сервира |
| 6 | viewport 375×667 (device emulation) | OK - формата в една колона (`grid-template-columns` с 1 стойност), таблица 348px, `scrollWidth === 375`, тъмен фон `rgb(15, 17, 21)`, 16px шрифт |

Бележки от приемката:
- Chrome не позволява прозорец под ~500px; 375px се проверява с device
  emulation (`375x667x2,mobile`), не с resize на прозореца.
- Стойност на `type="date"` в приемката се задава през native setter +
  `input` event (както D7 на STORY-3.2 предвижда `fireEvent.change`);
  ръчно през picker-а резултатът е същият.
- Нищо за поправяне в `ui/`; няма нови backlog елементи.
