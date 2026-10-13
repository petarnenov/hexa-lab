# Tasks

Команди: `cd ui && npm run typecheck && npm test` за `ui/`;
`npm run typecheck && npm test` в корена - не трябва да се променят като
резултат (`ui/` е извън обхвата им). При старт сложи `status: in-progress`
на `backlog/EPIC-3-web-ui/STORY-3.2-fees-screen/STORY-3.2.md`.

## 1. TASK-3.2.1 API клиент

- [x] 1.1 Промени `ui/vite.config.ts` `test.include` на `["src/**/*.test.{ts,tsx}"]` (design D7); провери, че `cd ui && npm test` още намира `App.test.tsx` (1 тест).
- [x] 1.2 (SUB-3.2.1.1) Създай `ui/src/api/types.ts` с `FeeLine`, `FeeReport`, `FeeRequest` като копие на JSON договора и коментар защо не е импорт (design D1); създай `ui/src/test/fixtures.ts` с `hh1Report` (JSON-ът от README) и helper-и `jsonResponse`/`htmlResponse` (D8); провери с `cd ui && npm run typecheck`, че fixture-ът се типизира като `FeeReport` без `as`.
- [x] 1.3 (SUB-3.2.1.3) Напиши `ui/src/api/ApiError.ts` (design D2) и първите тестове в `ui/src/api/calculateFees.test.ts` за грешки: 404 `HOUSEHOLD_NOT_FOUND`, 400 `INVALID_BILLING_PERIOD`, 500 `INTERNAL_ERROR`, 502 HTML → `NETWORK_ERROR` със `status 502`, reject → `NETWORK_ERROR` със `status 0` и съобщение с оригиналния текст; тестовете падат (няма `calculateFees`).
- [x] 1.4 (SUB-3.2.1.2) Добави в същия тест файл успешния път (URL `/households/hh-1/fees`, метод POST, header `content-type: application/json`, тяло `{"from":"2026-01-01","to":"2026-03-31"}`, върнат `hh1Report`) и `hh 1` → `/households/hh%201/fees`; имплементирай `ui/src/api/calculateFees.ts` по design D2 (`text()` + `JSON.parse`); `cd ui && npm test` зелено за всички тестове на клиента.
- [x] 1.5 Провери с `grep -rn 'src/' ui/src/api/` (и `grep -rn '\.\./\.\./' ui/src/`), че `ui/` не импортира `src/`.
- [x] 1.6 `cd ui && npm run typecheck && npm test` и кореновите `npm run typecheck && npm test` минават.

## 2. TASK-3.2.2 Форма

- [x] 2.1 (SUB-3.2.2.1) Тест в `ui/src/App.test.tsx`: полетата „Household“, „From“, „To“ се намират по label с `.value` = `hh-1`, `2026-01-01`, `2026-03-31`, има бутон „Calculate“; пада. Напиши `ui/src/FeeForm.tsx` по design D4 (контролирана форма, обгръщащи `<label>`, без валидация) и го сложи в `main` на `App.tsx` с временен `onSubmit` no-op; тестът минава.
- [x] 2.2 (SUB-3.2.2.2) Напиши `ui/src/useCalculateFees.ts` (design D3) и свържи `App` (`mutate`, `isPending`); тест: `clear`+`type` на „Household“ → `hh-2`, click „Calculate“ → `fetch` извикан веднъж с `/households/hh-2/fees` и тялото с defaults за датите; втори тест: Enter в полето „Household“ (`userEvent.keyboard("{Enter}")`) submit-ва веднъж.
- [x] 2.3 Тест за disabled: `fetch` mock с pending `Promise`; след click бутонът е `disabled`, втори click не вика `fetch` пак; resolve → бутонът е активен. Имплементирай `disabled={isPending}`.
- [x] 2.4 CSS за формата по design D6 (`.fee-form` grid, `input`/`button`, фокус, `button[disabled]`); провери в браузър с `npm run ui`: на 375px полетата са едно под друго без хоризонтален скрол, на 1440px са на един ред; `grep -nE '#[0-9a-f]{3,6}' ui/src/*.css ui/src/*.tsx` намира hex само в `:root`.
- [x] 2.5 `cd ui && npm run typecheck && npm test` и кореновите `npm run typecheck && npm test` минават.

## 3. TASK-3.2.3 Отчет

- [x] 3.1 (SUB-3.2.3.1) `ui/src/money.test.ts`: `2500000 → "2,500,000.00"`, `5239.73 → "5,239.73"`, `1500 → "1,500.00"`, `0 → "0.00"`; пада; напиши `ui/src/money.ts` (design D5); минава.
- [x] 3.2 (SUB-3.2.3.1) Тест в `App.test.tsx` (успешен път, SUB-3.2.4.1): submit с defaults → `fetch` с `/households/hh-1/fees` и `{"from":"2026-01-01","to":"2026-03-31"}` → таблица с редове „Alpha“/„Beta“/„Gamma“ в този ред, тарифи `standard`/`standard`/`premium`, клетки `2,500,000.00` и `5,239.73`; пада. Напиши `ui/src/FeeReportView.tsx` със `success` клона (таблица, `<thead>`, `<tbody>`, класове `num`) и го свържи в `App` (`status`, `data`, `error`); минава.
- [x] 3.3 (SUB-3.2.3.2) Тест: caption `hh-1 · 2026-01-01 → 2026-03-31` и footer с „Total“ и `14,239.73`; тест: отговор с един ред `fee: 1`, `total: 2` показва `2.00`; тест: `lines: []`, `total: 0` → без редове, Total `0.00`, няма alert. Добави `<caption>` и `<tfoot>`.
- [x] 3.4 (SUB-3.2.3.3) Тестове за състояния: idle при рендер (текст „Pick a household and a period.“, няма таблица, няма `role="alert"`); loading (pending `Promise` → „Calculating…“ в елемент с `aria-busy="true"`); error за `hh-404` (`role="alert"` с `HOUSEHOLD_NOT_FOUND` и „Household not found: hh-404“, няма таблица); success скрива idle текста. Имплементирай клоновете по design D5.
- [x] 3.5 CSS за отчета по design D6 (`table`, `.num`, `tfoot`, `caption`, `.alert`, `.badge`, `.muted`); провери в браузър при работещ `npm run http`: `hh-1` Q1 2026 показва трите реда и `14,239.73` в акцентния цвят; `hh-404` показва червен панел с badge; hex само в `:root`.
- [x] 3.6 `cd ui && npm run typecheck && npm test` и кореновите `npm run typecheck && npm test` минават.

## 4. TASK-3.2.4 Тестове

- [x] 4.1 (SUB-3.2.4.1) Прегледай `App.test.tsx`: успешният път е един тест от рендер до `14,239.73` с `userEvent` (не `fireEvent`), fixture-ът е `hh1Report`; `afterEach(vi.unstubAllGlobals)` присъства; `cd ui && npm test` отчита всички тестове зелени.
- [x] 4.2 (SUB-3.2.4.2) Допълни тестовете за грешки: 400 `INVALID_BILLING_PERIOD` (alert с кода и съобщението на сървъра), мрежова грешка (`fetch` reject → alert с `NETWORK_ERROR`, без crash); за всяка бутонът е активен след грешката; тест „нов submit чисти старата грешка“: първо 404, после 200 → alert-ът изчезва, таблицата се вижда.
- [x] 4.3 Негативен случай: временно смени очаквания total на `14,239.74`, увери се, че `cd ui && npm test` пада с името на теста; върни го.
- [x] 4.4 Ръчна проверка: при `npm run http` и `npm run ui` - defaults → три реда и total; `hh-404` → панел; `to` преди `from` → `INVALID_BILLING_PERIOD`; спри `npm run http` и submit-ни → `NETWORK_ERROR` без crash; провери 375px и 1440px.
- [x] 4.5 Sync docs: прегледай `proposal.md`, `design.md` и петте delta spec-а срещу реално написаното (файлове, сигнатури, текстове на съобщенията, CSS) и поправи отклоненията с по едно изречение *защо* в design.md. README не се пипа (UI секцията е STORY-3.3).
- [x] 4.6 `cd ui && npm run typecheck && npm test` и кореновите `npm run typecheck && npm test` минават; `npm run ui:test` от корена дава същия резултат.

## Workflow follow-up

- `/opsx:archive story-3-2-fees-screen` - мърджва delta spec-овете и сменя status на STORY-3.2, TASK-3.2.x и SUB-3.2.x.y на `done`.
- `/commit`, после `/clear`.
