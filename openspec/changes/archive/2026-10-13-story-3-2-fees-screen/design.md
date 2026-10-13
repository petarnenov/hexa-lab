# Design

## Context

Вж. proposal.md - Why. Състояние след STORY-3.1: `ui/` има Vite 8 + Vitest 5,
React 19.3, `@tanstack/react-query` 5.104, Testing Library (react 16.3,
user-event 14.6, jest-dom 7), jsdom 30. `main.tsx` вече увива `<App/>` в
`QueryClientProvider`; `test/render.tsx` дава `renderWithQuery` с
`retry: false` за queries и mutations. Темата е в `styles.css` като
променливи (`--surface`, `--border`, `--accent`, `--danger`, `--space-*`,
`--font-mono`); `color-scheme: dark` прави native date picker-а тъмен.

Договорът на сървъра (`openspec/specs/http-adapter`, `README.md`):
`POST /households/:id/fees`, тяло `{from,to}`, отговор `FeeReport` JSON;
грешки `{error, message}` със статуси 400 (`BAD_REQUEST`,
`INVALID_BILLING_PERIOD`), 404 (`NOT_FOUND`, `HOUSEHOLD_NOT_FOUND`,
`FEE_SCHEDULE_NOT_FOUND`), 500 (`INTERNAL_ERROR`). Proxy-то на Vite връща
5xx с не-JSON тяло при спрян backend.

Ограничения: `ui/` не импортира `src/`; `src/` не се пипа; без нови
зависимости (всичко нужно е инсталирано); тестовете с mock-нат `fetch`,
без MSW; `Response`/`fetch` са глобални в Node 24 и Vitest не ги маха в
jsdom среда (проверено: `typeof Response === "function"`).

## Goals / Non-Goals

**Goals:**
- Един екран, в който компонентите не знаят за `fetch`, а API клиентът не
  знае за React - същата идея „порт/адаптер“, пренесена в UI-я.
- Всеки сценарий от трите нови spec-а е покрит с тест, без реален сървър.
- Нула промени в `ui/package.json` и в `src/`.

**Non-Goals:**
- Споделяне на типове със `src/` (умишлено копие - вж. D1).
- Кеширане/`useQuery`: това е команда (POST), не заявка за четене.
- Visual regression тестове; responsive поведението се проверява ръчно.

## Decisions

### D1. Файлова структура: `api/` е портът, компонентите са плоски
```
ui/src/
  api/types.ts            FeeLine, FeeReport, FeeRequest (копие на JSON договора)
  api/ApiError.ts         class ApiError extends Error { status; code }
  api/calculateFees.ts    calculateFees(req): Promise<FeeReport>
  api/calculateFees.test.ts
  useCalculateFees.ts     hook: useMutation({ mutationFn: calculateFees })
  FeeForm.tsx             контролирана форма
  FeeReportView.tsx       таблица + idle/loading/error
  money.ts / money.test.ts  money(n): string (unit тест без рендер)
  test/fixtures.ts        hh1Report (JSON от README), errorBody helpers
  App.tsx / App.test.tsx  държи mutation-а; end-to-end тестове
```
- `api/` е единственото място с `fetch` - компонентите получават функции и
  данни. Алтернатива: `fetch` направо в hook-а - по-кратко, но смесва HTTP
  с React и не може да се тества без рендер.
- Типовете са **копие**, не импорт от `src/domain/FeeReport.ts`, с коментар
  защо: UI-ят е отделен клиент и познава само JSON договора на HTTP
  адаптера. `period` е `{from: string; to: string}` - на клиента няма
  `BillingPeriod` обект. Ако договорът се промени, тестът на API клиента с
  fixture-а от README ще покаже разминаването.
- Плоски компоненти без `components/` папка: два компонента + hook, папка
  би била ритуал. Тест файловете стоят до кода.

### D2. `ApiError` чете тялото като текст и пробва JSON
```ts
export class ApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message); this.name = "ApiError";
  }
}
```
`calculateFees` при `!res.ok`: `const text = await res.text()`, после
`JSON.parse` в `try`; ако резултатът е обект с низ `error`, грешката е
`new ApiError(res.status, body.error, body.message ?? …)`; иначе
`new ApiError(res.status, "NETWORK_ERROR", \`Server returned ${status} without a JSON error body\`)`.
Ако JSON тялото има `error`, но няма низ `message`, съобщението е самият
код (при apply: единственият разумен fallback, за да не е празен панелът).
Отхвърлен `fetch` се хваща и става `new ApiError(0, "NETWORK_ERROR", \`Network error: ${err.message}\`)`.
- `text()` + `JSON.parse`, а не `res.json()`: при HTML от proxy-то `json()`
  хвърля `SyntaxError`, който трябва да се хваща отделно и тялото вече е
  консумирано. Един път четене, едно `try`.
- `status = 0` за reject-нат `fetch` (конвенция на XHR за „няма отговор“);
  spec-ът го фиксира, за да е проверимо.
- Няма Zod/валидация на успешния отговор: 2xx тялото се връща като
  `FeeReport` с `as`. Учебен проект с един endpoint; валидацията би
  добавила зависимост или 30 реда ръчен код без тест, който да ги оправдае.

### D3. Състоянието живее в `useMutation`, App го разпределя
```ts
export function useCalculateFees() {
  return useMutation<FeeReport, ApiError, FeeRequest>({ mutationFn: calculateFees });
}
```
`App`: `const m = useCalculateFees();` →
`<FeeForm onSubmit={m.mutate} isPending={m.isPending} />` и
`<FeeReportView status={m.status} report={m.data} error={m.error} />`.
- `useMutation`, не `useQuery`: POST е команда (сървърът и публикува
  отчета през `FeeReportPublisher`), не трябва да се изпълнява при mount
  или refetch при фокус. React Query е вече в бандъла от STORY-3.1 -
  използваме го за това, за което е там.
- `m.status` (`idle | pending | error | success`) се подава директно: при
  `mutate` React Query сам нулира `error`/`data` на `pending`, така че
  „нов submit чисти старата грешка“ идва безплатно, без `reset()`.
- Типизиран generic `<FeeReport, ApiError, FeeRequest>` - `m.error` е
  `ApiError | null`, компонентът чете `error.code` без `instanceof`. Ако
  `calculateFees` хвърли нещо друго (bug), D2 гарантира, че не го прави.

### D4. Формата: native `<form>`, `useState` за трите полета
```tsx
<form className="fee-form" onSubmit={(e) => { e.preventDefault(); onSubmit({ householdId, from, to }); }}>
  <label>Household <input value={householdId} onChange=… /></label>
  <label>From <input type="date" value={from} onChange=… /></label>
  <label>To <input type="date" value={to} onChange=… /></label>
  <button type="submit" disabled={isPending}>Calculate</button>
</form>
```
- Native `<form onSubmit>` дава Enter-submit от всяко поле без код, и
  `disabled` бутон блокира и Enter-submit (браузърът не submit-ва форма с
  единствен disabled submit бутон) - двата сценария „Enter“ и „повторно
  натискане не изпраща втора заявка“ се покриват от платформата.
- Етикет чрез обгръщащ `<label>` (без `htmlFor`/`id`): по-малко код, а
  `getByLabelText("Household")` работи. Защото „From“/„To“ не съвпадат като
  подниз на нищо друго, няма двусмислие.
- Без `required`/`min`/`max`/`pattern`: SUB-3.2.2.1 изрично оставя
  валидацията на use case-а. `type="date"` сам по себе си пречи на
  въвеждане на не-дата в браузър, но не на обърнат период - именно това
  показва `INVALID_BILLING_PERIOD` в UI-я.
- Без form библиотека: три полета.

### D5. Отчетът: таблица + `money()`, състоянията в същия компонент
`FeeReportView` взима `status`, `report`, `error` и рендерира едно от
четирите:
- `idle`: `<p class="muted">Pick a household and a period.</p>`
- `pending`: `<p aria-busy="true">Calculating…</p>`
- `error`: `<div role="alert" class="alert"><span class="badge">{code}</span><p>{message}</p></div>`
- `success`: `<table>` с `<caption>` `hh-1 · 2026-01-01 → 2026-03-31`,
  `<thead>` Account / AUM / Schedule / Fee, `<tbody>` ред на линия
  (`key = accountId`), `<tfoot>` „Total“ + `money(report.total)`.
- `money(n)` = `new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)`,
  форматерът създаден веднъж на модулно ниво. Отделен файл `money.ts`, за
  да има unit тест на `money()` без рендер. `maximumFractionDigits: 2` е
  нужен (default-ът е 3 и `5239.734` би показал 3 знака).
- Total идва от `report.total`, не `sum(lines)` - сървърът е източникът
  на истината (и там вече е `roundToCents`); тестът „`fee: 1`, `total: 2`
  показва `2.00`“ пази това.
- Четирите състояния са в един компонент, не четири малки: са
  взаимно изключващи се и споделят CSS. Ако някой порасне, се вади.
- `error` е типизиран `ApiError | null` (така го дава `useMutation`), затова
  error клонът има fallback `UNKNOWN` / „Unknown error“ за `null` - недостижим
  при `status === "error"`, но компилаторът го иска и е по-честно от `!`.
  Таблицата е в отделен вътрешен компонент `ReportTable` в същия файл.

### D6. CSS: само нови класове със съществуващите променливи
Добавки в `styles.css` (без нови цветове):
- `.fee-form`: `display: grid; gap: var(--space-2)`; при
  `@media (min-width: 640px)` → `grid-template-columns: 1fr auto auto auto; align-items: end`.
  Mobile-first: една колона по подразбиране.
- `input`, `button`: `background: var(--surface); border: 1px solid var(--border); color: var(--text); border-radius: var(--radius); padding: var(--space-2) var(--space-3); font: inherit`.
  `button[disabled]` с `opacity: .6; cursor: not-allowed`. Фокус:
  `outline: 2px solid var(--accent)`.
- `.report table`: `width: 100%; border-collapse: collapse`;
  `td.num, th.num { text-align: right; font-variant-numeric: tabular-nums }`;
  `tfoot td { font-weight: 600; color: var(--accent); border-top: 1px solid var(--border) }`;
  `caption { text-align: left; color: var(--muted); font-family: var(--font-mono) }`.
- `.fee-form label`: `display: grid; gap: var(--space-1); color: var(--muted); font-size: .875rem`
  (етикетът над полето, не до него - добавено при apply, иначе текстът и
  input-ът са на един ред и ширините в grid-а не се подравняват).
- `.alert`: `border: 1px solid var(--danger); border-radius: var(--radius); padding: var(--space-3); background: var(--surface)`;
  `.badge`: `font-family: var(--font-mono); font-size: .8rem; color: var(--danger); border: 1px solid var(--danger); border-radius: 4px; padding: 0 var(--space-1)`.
- `.muted { color: var(--muted) }`.
Проверка както в STORY-3.1: `grep -nE '#[0-9a-f]{3,6}' ui/src/*.css ui/src/*.tsx`
намира hex само в `:root`.

### D7. Тестове: `vi.stubGlobal("fetch")` с истински `Response`
```ts
const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);
fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(hh1Report), {
  status: 200, headers: { "content-type": "application/json" } }));
```
- `Response` от Node вместо ръчен `{ ok, status, json }`: тества и
  четенето на тялото (`text()`), и `ok`-логиката за реални статуси.
  Проверено, че е глобален в jsdom средата на Vitest 5.
- `afterEach(vi.unstubAllGlobals)` в тестовете, които stub-ват (не в
  `setup.ts` - setup-ът остава общ и страничен ефект само за DOM).
- API клиентът се тества в `calculateFees.test.ts` (unit: URL, метод,
  header, тяло, 400/404/500/HTML/reject). `App.test.tsx` тества
  end-to-end през компонентите с `userEvent` (`setup()` + `click`/
  `keyboard("{Enter}")`): успешен път с defaults, `HOUSEHOLD_NOT_FOUND`,
  `INVALID_BILLING_PERIOD`, мрежова грешка, нов submit чисти грешката,
  бутон disabled докато чака (с `Promise` без resolve, после resolve).
- Тестът „бутонът е disabled докато чака“ ползва `waitFor(() => expect(button).toBeEnabled())`
  след resolve, не `findByRole` - бутонът съществува през цялото време и
  `findByRole` връща веднага, преди React Query да е обновил състоянието
  (първата версия на теста падна точно така).
- Тестовете **не пишат в date полетата**: `userEvent.type` върху
  `type="date"` в jsdom е ненадежден. Сценариите за грешки сменят само
  „Household“ (`clear` + `type`) или не пипат нищо и оставят mock-а да
  върне грешката. Датите се проверяват само като defaults и в тялото на
  заявката. (Промяна на стойност на date input се прави с
  `fireEvent.change`, ако някога стане нужно - не в този change.)
- `money.test.ts`: `2500000 → "2,500,000.00"`, `5239.73 → "5,239.73"`,
  `1500 → "1,500.00"`, `0 → "0.00"`.
- `vite.config.ts` `test.include` → `["src/**/*.test.{ts,tsx}"]`, иначе
  `.test.ts` файловете са невидими (spec `web-ui-toolchain` се обновява).

### D8. Fixture-ът е копие на README-то, в един файл
`test/fixtures.ts`: `hh1Report` = JSON-ът от README (три реда, `14239.73`)
като `FeeReport`, и `jsonResponse(status, body)` / `htmlResponse(status)`
helper-и. Ако README се промени, fixture-ът се сменя на ръка - тест, който
чете README, би обвързал UI тестовете с markdown парсене.

## Risks / Trade-offs

- [`Response` не е глобален в jsdom среда при бъдеща версия на Vitest]
  → helper-ите в `fixtures.ts` са единственото място, което го конструира;
  смяна към ръчен обект `{ ok, status, text }` е локална.
- [`userEvent` + date inputs] → избегнато по D7; ако се наложи, `fireEvent.change`.
- [`getByLabelText("From")` хваща и „From“ в caption-а? Не - caption-ът не
  е label] → но текстът `2026-01-01 → 2026-03-31` съдържа датите; тестовете
  за defaults четат `.value` на input-а, не `getByText` на датата.
- [`aria-busy` на `<p>`, а не на цялата `main`] → достатъчно за spec-а;
  screen reader-ите четат „Calculating…“ като live текст, защото
  елементът се появява; ако е нужно, `aria-live="polite"` на обвивката
  на отчета - отложено.
- [Double-submit при React 19 StrictMode в dev] → `mutate` не е ефект,
  StrictMode не го удвоява; тестовете не ползват StrictMode.
- [Копираните типове се разминават със `src/domain/FeeReport.ts`] →
  приет trade-off (D1); fixture-ът от README е спойката.

- [Таблицата на 375px е 348px при 343px колона] → 5px overflow от
  `border-collapse` + padding, без хоризонтален скрол на страницата
  (`scrollWidth === 375`, проверено с Playwright); приема се. Ако колоните
  пораснат, `overflow-x: auto` на обвивка около таблицата.
- [`npm run ui -- --port 5174` не стига до Vite] → открито при apply:
  скриптът е `npm --prefix ui run dev`, т.е. вложен npm, който изяжда
  `--port` като своя опция и подава само `5174` като positional root
  (`vite 5174` → proxy-то не работи, защото конфигът не се намира).
  Работи `npm run ui -- -- --port 5174` или `cd ui && npm run dev -- --port 5174`.
  Твърдението в design D1 на STORY-3.1 е грешно; поправката на документацията
  (README секция UI) е в STORY-3.3, тук само се записва.

## Migration Plan

Няма - нови файлове и разширение на `App.tsx`/`styles.css`. Rollback: `git revert`.
