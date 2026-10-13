# web-ui-fee-report Specification

## Purpose

Определя как се показва отчетът на екрана - таблицата с редовете и total,
caption с household и период, форматът на числата - и какво вижда
потребителят във всяко от състоянията idle, loading, error и success.

## Requirements

### Requirement: Таблица с ред за всеки акаунт
При успешен отговор отчетът SHALL е таблица с колони „Account“, „AUM“,
„Schedule“, „Fee“ и по един ред за всеки елемент на `lines`, в реда от
сървъра. „Account“ показва `accountName`, „Schedule“ - `feeScheduleId`.

#### Scenario: Три реда за hh-1
- **GIVEN** отговорът е отчетът за `hh-1` Q1 2026 от README
- **WHEN** се покаже
- **THEN** таблицата има ред за „Alpha“, „Beta“, „Gamma“ в този ред, с тарифи `standard`, `standard`, `premium`

#### Scenario: Отчет без редове
- **GIVEN** отговорът има `lines: []` и `total: 0`
- **WHEN** се покаже
- **THEN** таблицата има заглавен ред и Total `0.00`, без ред за акаунт и без грешка

### Requirement: Числата са форматирани en-US с два знака и дясно подравнени
AUM, Fee и Total SHALL са форматирани с разделител на хиляди и точно два
десетични знака (`en-US`), SHALL са дясно подравнени и SHALL използват
`tabular-nums`. Форматирането SHALL е на едно място, за да няма
разминаване между ред и total.

#### Scenario: Стойности от README
- **GIVEN** редът на „Alpha“ има `aum: 2500000`, `fee: 5239.73`
- **WHEN** се покаже
- **THEN** клетките показват `2,500,000.00` и `5,239.73`

#### Scenario: Цяло число
- **GIVEN** `fee: 1500`
- **WHEN** се покаже
- **THEN** клетката показва `1,500.00`

### Requirement: Total и период
Таблицата SHALL има caption `<householdId> · <from> → <to>` и footer ред
„Total“ със сумата от отчета (`total`, не преизчислена на клиента),
удебелена и в акцентния цвят.

#### Scenario: Total за hh-1
- **GIVEN** отчетът за `hh-1` Q1 2026
- **WHEN** се покаже
- **THEN** caption-ът е `hh-1 · 2026-01-01 → 2026-03-31` и footer-ът показва „Total“ и `14,239.73`

#### Scenario: Total идва от сървъра
- **GIVEN** отговор с един ред `fee: 1` и `total: 2`
- **WHEN** се покаже
- **THEN** footer-ът показва `2.00` (стойността на сървъра), не `1.00`

### Requirement: Състояние idle
Преди първата заявка екранът SHALL показва тих текст „Pick a household and
a period.“ и SHALL не показва таблица или грешка.

#### Scenario: Първо отваряне
- **WHEN** `App` се рендерира
- **THEN** се вижда „Pick a household and a period.“, няма таблица и няма `role="alert"`

### Requirement: Състояние loading
Докато заявката тече екранът SHALL показва „Calculating…“ в област с
`aria-busy="true"` и SHALL не показва стар отчет или стара грешка.

#### Scenario: Чакане
- **GIVEN** `fetch` още не е отговорил
- **WHEN** потребителят submit-не
- **THEN** се вижда „Calculating…“ в елемент с `aria-busy="true"`

### Requirement: Състояние error
При грешка екранът SHALL показва панел с `role="alert"`, съдържащ кода
(`code` на грешката) като badge и съобщението под него, с рамка в цвета за
грешка. Нов submit SHALL скрива предишния панел до следващия отговор.

#### Scenario: Household not found
- **GIVEN** сървърът връща `404` `{"error":"HOUSEHOLD_NOT_FOUND","message":"Household not found: hh-404"}`
- **WHEN** потребителят submit-не за `hh-404`
- **THEN** има `role="alert"` с текст `HOUSEHOLD_NOT_FOUND` и „Household not found: hh-404“, и няма таблица

#### Scenario: Invalid billing period
- **GIVEN** сървърът връща `400` с `error: "INVALID_BILLING_PERIOD"`
- **WHEN** потребителят submit-не
- **THEN** панелът показва `INVALID_BILLING_PERIOD` и съобщението на сървъра

#### Scenario: Мрежова грешка
- **GIVEN** `fetch` отхвърля промиса
- **WHEN** потребителят submit-не
- **THEN** панелът показва `NETWORK_ERROR` и четимо съобщение, без crash

#### Scenario: Нов submit чисти старата грешка
- **GIVEN** на екрана има панел с `HOUSEHOLD_NOT_FOUND`
- **WHEN** потребителят submit-не отново и сървърът върне `200`
- **THEN** панелът изчезва и се показва таблицата

### Requirement: Състояние success
При успешен отговор екранът SHALL показва таблицата и SHALL не показва idle
текста, „Calculating…“ или панел за грешка.

#### Scenario: Успешен път с defaults
- **GIVEN** `fetch` връща отчета за `hh-1` от README
- **WHEN** потребителят submit-не с defaults
- **THEN** таблицата с трите реда и `14,239.73` се вижда, а „Pick a household and a period.“ и `role="alert"` ги няма
