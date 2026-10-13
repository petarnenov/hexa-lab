# Proposal

## Why

STORY-3.1 остави `ui/` с тема, header и празен `main`: страницата се отваря,
но не прави нищо. STORY-3.2 слага единствения екран на EPIC-3 - форма
(household, от, до) и отчет (редове + total) - така че в браузъра се виждат
същите числа като от CLI и `curl` (`hh-1`, Q1 2026, `14 239.73`), без
сървърът да се променя заради новия клиент.

## What Changes

- **API клиент** (`ui/src/api/`): типове `FeeLine`, `FeeReport`, `FeeRequest`
  като копие на JSON договора на HTTP адаптера (не импорт от `src/`); една
  функция `calculateFees` върху `fetch` към `POST /households/:id/fees`;
  клас `ApiError` със `status` и `code`, който чете `{error, message}` от
  тялото, а при не-JSON отговор или паднал `fetch` дава `NETWORK_ERROR`.
- **Форма** (`FeeForm.tsx`): три полета с `<label>` - household (text),
  from/to (`type="date"`) - предварително попълнени с `hh-1`, `2026-01-01`,
  `2026-03-31`; бутон „Calculate“; контролирана с `useState`, без клиентска
  валидация на датите (това е работа на use case-а). Submit през
  `useMutation` (hook `useCalculateFees`); бутонът е disabled докато заявката
  тече; Enter в поле също submit-ва.
- **Отчет** (`FeeReportView.tsx`): таблица Account / AUM / Schedule / Fee с
  дясно подравнени `tabular-nums` числа, форматирани на едно място с
  `Intl.NumberFormat("en-US")`; caption `hh-1 · 2026-01-01 → 2026-03-31`;
  `<tfoot>` с Total в акцентния цвят. Състояния: idle (тих текст), loading
  („Calculating…“, `aria-busy`), error (панел `role="alert"` с кода като
  badge и съобщението), success (таблицата).
- **App** държи mutation-а и подава `onSubmit`/`isPending` на формата и
  `data`/`error` на отчета. Smoke тестът от STORY-3.1 остава валиден.
- **Тестове**: Vitest + Testing Library с mock-нат `fetch`
  (`vi.stubGlobal`), без MSW. Unit тестове за API клиента (URL, метод,
  тяло, 400/404/500/не-JSON/reject) и end-to-end през компонентите:
  успешен път с fixture-а от README, `HOUSEHOLD_NOT_FOUND`,
  `INVALID_BILLING_PERIOD`, мрежова грешка, нов submit чисти старата грешка.
  Vitest include се разширява до `src/**/*.test.{ts,tsx}`, за да покрие
  тестовете на API клиента, които нямат JSX.
- **CSS** в `ui/src/styles.css`: стилове за формата (полетата на един ред на
  desktop, едно под друго на телефон), таблицата, error панела и badge-а -
  само с вече дефинираните променливи.

## Покрити backlog елементи

- STORY-3.2 Екран „Такси на household“
  - TASK-3.2.1 API клиент
    - SUB-3.2.1.1 Типове FeeReport
    - SUB-3.2.1.2 calculateFees
    - SUB-3.2.1.3 ApiError
  - TASK-3.2.2 Форма
    - SUB-3.2.2.1 Полета и defaults
    - SUB-3.2.2.2 Submit през useMutation
  - TASK-3.2.3 Отчет
    - SUB-3.2.3.1 Таблица с редове
    - SUB-3.2.3.2 Total и период
    - SUB-3.2.3.3 Състояния idle/loading/error
  - TASK-3.2.4 Тестове
    - SUB-3.2.4.1 Успешен път
    - SUB-3.2.4.2 Грешки от сървъра

## Capabilities

### New Capabilities

- `web-ui-api-client`: как UI-ят говори със сървъра - заявката към
  `POST /households/:id/fees`, формата на отчета, който очаква, и как всяка
  грешка (HTTP статус с JSON тяло, не-JSON отговор, мрежова) се превръща в
  една структурирана грешка с `status` и `code`.
- `web-ui-fee-form`: формата за household и период - полета, етикети,
  стойности по подразбиране, submit (бутон и Enter), disabled докато тече
  заявка, без клиентска валидация на датите.
- `web-ui-fee-report`: отчетът и състоянията на екрана - таблицата с
  редовете и total, caption с household и период, формат на числата, и
  какво се вижда при idle / loading / error / success.

### Modified Capabilities

- `web-ui-shell`: изискването „App shell показва заглавие и празно
  съдържание“ се променя - `main` вече съдържа формата и отчета; header-ът и
  smoke сценарият остават.
- `web-ui-toolchain`: изискването „Скрипт test изпълнява UI тестовете в DOM
  среда“ се разширява от `*.test.tsx` до `*.test.{ts,tsx}`, за да се откриват
  и тестове без JSX (API клиента).

## Non-goals

- Промени в `src/`: HTTP адаптерът не получава CORS, нов маршрут или нов
  формат на грешките. UI-ят се адаптира към съществуващия договор.
- README секция за UI, диаграма, pack на `ui/`, ръчна приемка - STORY-3.3.
  (README в корена все още няма UI секция; sync docs в този change обхваща
  артефактите на OpenSpec.)
- Клиентска валидация на датите, запазване на последната заявка
  (localStorage/URL), история на отчети, светла тема, i18n на числата
  (само `en-US`).
- MSW, form библиотека, компонентна библиотека, нови зависимости в `ui/`
  (всички нужни пакети са вече инсталирани от STORY-3.1).
- Печат/експорт на отчета, сортиране на редовете.

## Impact

- Нови файлове в `ui/src/`: `api/types.ts`, `api/ApiError.ts`,
  `api/calculateFees.ts` (+ тест), `useCalculateFees.ts`, `FeeForm.tsx`,
  `FeeReportView.tsx`, `money.ts` (+ тест), `test/fixtures.ts`; разширени
  `App.tsx`, `App.test.tsx`, `styles.css`.
- `ui/vite.config.ts`: само `test.include`. Без нови зависимости; `ui/package.json`
  и lockfile не се променят.
- Spec-ове: три нови capability, две MODIFIED изисквания (`web-ui-shell`,
  `web-ui-toolchain`). Spec-овете на `src/` (`http-adapter`, `fee-report`)
  не се променят - UI-ят е клиент на техния договор.
- Корен: `npm run typecheck && npm test` не са засегнати (`ui/` е извън
  `tsconfig.json` и `test/`).
