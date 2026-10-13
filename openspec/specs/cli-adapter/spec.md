# cli-adapter Specification

## Purpose
Определя терминалния вход към use case-а „изчисли таксите на household“:
аргументи, табличен и JSON изход, exit кодове — така че терминалният
протокол остава в адаптера, а use case-ът е същият като зад HTTP.

## Requirements

### Requirement: CLI адаптерът зависи само от inbound порта и подадени потоци
CLI адаптерът SHALL приема стойност, която изпълнява `CalculateHouseholdFees`,
списък аргументи и двойка изходни потоци (stdout, stderr), и SHALL връща
exit кода като стойност, без да вика `process.exit`, без да чете
`process.argv` или `process.env` и без да пише в процесните потоци, когато
му са подадени други.

#### Scenario: Fake use case и fake потоци
- **GIVEN** fake use case `{ execute }`, който връща отчет, и два събиращи fake потока
- **WHEN** адаптерът бъде изпълнен с валидни аргументи
- **THEN** резултатът е число (exit код), целият изход е във fake потоците, а `process.stdout`/`process.stderr` не са докоснати

### Requirement: Аргументите са householdId, from, to и по желание --json
Адаптерът SHALL изисква точно три позиционни аргумента `<householdId> <from>
<to>` и SHALL приема флага `--json` на произволна позиция. При друг брой
позиционни аргументи или непознат флаг адаптерът SHALL пише usage ред на
stderr, SHALL не вика use case-а и SHALL връща `2`.

#### Scenario: Валидни аргументи
- **GIVEN** fake use case
- **WHEN** аргументите са `hh-1 2026-01-01 2026-03-31`
- **THEN** use case-ът е извикан с `{ householdId: "hh-1", from: "2026-01-01", to: "2026-03-31" }`

#### Scenario: Флаг преди позиционните
- **GIVEN** fake use case
- **WHEN** аргументите са `--json hh-1 2026-01-01 2026-03-31`
- **THEN** use case-ът е извикан с същата команда и изходът е JSON

#### Scenario: Твърде малко аргументи
- **GIVEN** fake use case
- **WHEN** аргументите са `hh-1 2026-01-01`
- **THEN** exit код `2`, stderr съдържа `usage` и `<householdId> <from> <to> [--json]`, stdout е празен, use case-ът не е извикан

#### Scenario: Твърде много аргументи
- **GIVEN** fake use case
- **WHEN** аргументите са `hh-1 2026-01-01 2026-03-31 extra`
- **THEN** exit код `2` и usage на stderr

#### Scenario: Непознат флаг
- **GIVEN** fake use case
- **WHEN** аргументите са `hh-1 2026-01-01 2026-03-31 --yaml`
- **THEN** exit код `2`, usage на stderr, use case-ът не е извикан

#### Scenario: Датите не се валидират в адаптера
- **GIVEN** fake use case, който записва командата
- **WHEN** аргументите са `hh-1 not-a-date 2026-03-31`
- **THEN** use case-ът е извикан с `from = "not-a-date"`

### Requirement: Без --json изходът е таблица с ред на сметка и TOTAL
При успех без `--json` адаптерът SHALL пише на stdout: заглавен ред с
household и период, по един ред на сметка в реда на отчета — с `accountId`,
`accountName`, `aum`, `feeScheduleId` и `fee` с две десетични цифри, разделени
с интервали — и последен ред `TOTAL` с общата сума с две десетични цифри.
Exit кодът SHALL е `0`, stderr SHALL остане празен.

#### Scenario: Таблица за hh-1
- **GIVEN** fake use case, който връща отчета на `hh-1` за Q1 2026 (acc-1 Alpha 2 500 000 standard 5239.73; acc-2; acc-3; `total = 14239.73`)
- **WHEN** аргументите са `hh-1 2026-01-01 2026-03-31`
- **THEN** exit `0`; stdout има 5 реда: първият съдържа `hh-1` и `2026-01-01..2026-03-31`; вторият съдържа `acc-1`, `Alpha`, `2500000`, `standard`, `5239.73` в този ред; последният отговаря на `^TOTAL\s+14239\.73$`; stderr е празен

#### Scenario: Цяло число се печата с две десетични цифри
- **GIVEN** fake use case с отчет, в който една сметка има `fee = 9000` и `total = 9000`
- **WHEN** табличен изход
- **THEN** редът на сметката завършва с `9000.00`, а последният ред е `TOTAL` … `9000.00`

### Requirement: С --json изходът е същият JSON като HTTP отговора
При успех с `--json` адаптерът SHALL пише на stdout точно един ред:
JSON сериализацията на отчета (същата структура и същият текст, който HTTP
адаптерът връща за същия отчет), завършен с нов ред. Exit кодът SHALL е `0`,
stderr SHALL остане празен, и нищо друго SHALL не се пише на stdout.

#### Scenario: JSON за hh-1
- **GIVEN** fake use case, който връща отчета на `hh-1` за Q1 2026
- **WHEN** аргументите са `hh-1 2026-01-01 2026-03-31 --json`
- **THEN** exit `0`; stdout е един ред; `JSON.parse` на реда е deepEqual на отчета с `total === 14239.73`; stderr е празен

#### Scenario: Същият текст като HTTP
- **GIVEN** един и същ отчет, подаден и на HTTP адаптера, и на CLI адаптера с `--json`
- **WHEN** се сравнят тялото на HTTP отговора и stdout на CLI без завършващия нов ред
- **THEN** двата низа са равни

### Requirement: Domain грешка дава един ред на stderr и exit 1
Когато use case-ът отхвърли с domain грешка, адаптерът SHALL пише на stderr
един ред с нейния `code` и `message` във формат `<code>: <message>`, SHALL не
пише нищо на stdout (и в табличен, и в `--json` режим) и SHALL връща `1`.
Грешка, която не е domain грешка, SHALL не се поглъща — обещанието се отхвърля
с нея.

#### Scenario: Липсващ household
- **GIVEN** fake use case, който отхвърля с `HouseholdNotFound("hh-404")`
- **WHEN** аргументите са `hh-404 2026-01-01 2026-03-31`
- **THEN** exit `1`, stderr е точно `HOUSEHOLD_NOT_FOUND: Household not found: hh-404` плюс нов ред, stdout е празен

#### Scenario: Невалиден период в --json режим
- **GIVEN** fake use case, който отхвърля с `InvalidBillingPeriod("from must be YYYY-MM-DD, got \"x\"")`
- **WHEN** аргументите са `hh-1 x 2026-03-31 --json`
- **THEN** exit `1`, stderr започва с `INVALID_BILLING_PERIOD: `, stdout е празен

#### Scenario: Неочаквана грешка
- **GIVEN** fake use case, който отхвърля с `new Error("disk on fire")`
- **WHEN** валидни аргументи
- **THEN** изпълнението на адаптера се отхвърля със същата грешка (не връща exit код)
