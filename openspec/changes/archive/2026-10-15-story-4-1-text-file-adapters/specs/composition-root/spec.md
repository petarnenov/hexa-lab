# Spec Delta

## MODIFIED Requirements

### Requirement: STORAGE избира storage, memory по подразбиране
Composition root-ът SHALL чете `STORAGE` от подадената конфигурация: липсваща
или празна стойност SHALL означава `memory`; `memory` SHALL сглобява in-memory
репозиториите със seed данните; `json` SHALL сглобява JSON-file
репозиториите върху `accounts.json` и `fee-schedules.json` в data папката;
`txt` SHALL сглобява txt репозиториите върху `accounts.txt` и
`fee-schedules.txt` в data папката. Трите режима SHALL дават идентичен отчет
за едни и същи данни.

#### Scenario: Липсващ STORAGE е memory
- **GIVEN** конфигурация без `STORAGE`
- **WHEN** composition root-ът бъде извикан и use case-ът изпълнен за `hh-1`, Q1 2026
- **THEN** отчетът има три реда (`acc-1`, `acc-2`, `acc-3`) и `total 14239.73`, без да се докосва файловата система за данни

#### Scenario: STORAGE=json чете data/
- **GIVEN** конфигурация `STORAGE=json` без `DATA_DIR`
- **WHEN** composition root-ът бъде извикан и use case-ът изпълнен за `hh-1`, Q1 2026
- **THEN** отчетът е deepEqual на отчета от memory режима, включително `total 14239.73`

#### Scenario: STORAGE=txt чете data/*.txt
- **GIVEN** конфигурация `STORAGE=txt` без `DATA_DIR`
- **WHEN** composition root-ът бъде извикан и use case-ът изпълнен за `hh-1`, Q1 2026
- **THEN** отчетът е deepEqual на отчета от memory режима, а логът е `[bootstrap] STORAGE=txt`

#### Scenario: Непозната стойност е ясна грешка
- **GIVEN** конфигурация `STORAGE=sqlite`
- **WHEN** composition root-ът бъде извикан
- **THEN** хвърля грешка **синхронно**, преди да сглоби нещо, чието съобщение съдържа `STORAGE`, получената стойност `sqlite` и позволените `memory`, `json` и `txt`

### Requirement: Seed данните за memory съвпадат с data/*.json
Bootstrap SHALL предоставя seed данни (сметки и тарифи) за memory режима,
които SHALL са структурно идентични с `data/accounts.json`,
`data/fee-schedules.json`, `data/accounts.txt` и `data/fee-schedules.txt`
(последните две прочетени през txt репозиториите), и тест SHALL пази тази
идентичност.

#### Scenario: Seed равен на файловете
- **GIVEN** seed сметките и тарифите от bootstrap
- **WHEN** се сравнят (deepEqual) с parse-натото съдържание на `data/*.json` и с прочетеното през txt репозиториите от `data/*.txt`
- **THEN** са равни

#### Scenario: Разминаване се хваща
- **GIVEN** някой промени AUM на `acc-1` в `data/accounts.json` без да пипа seed-а
- **WHEN** се изпълни `npm test`
- **THEN** тестът за синхрон пада и назовава разликата

## ADDED Requirements

### Requirement: PUBLISHER избира publisher, console по подразбиране
Composition root-ът SHALL чете `PUBLISHER`: липсваща или празна стойност и
`console` SHALL означават console publisher към подадения stderr; `txt`
SHALL означава txt publisher към `REPORT_FILE` или, ако той липсва или е
празен, към `fee-reports.txt` в data папката. При `txt` SHALL пише ред
`[bootstrap] PUBLISHER=txt REPORT_FILE=<път>` след реда за storage-а; при
`console` SHALL не пише допълнителен ред. Непозната стойност SHALL хвърля
синхронно, преди лог ред, със съобщение, съдържащо `PUBLISHER`, стойността
и позволените `console` и `txt`.

#### Scenario: PUBLISHER=txt
- **GIVEN** `PUBLISHER=txt`, `REPORT_FILE=<временен файл>` и събиращ fake stderr
- **WHEN** use case-ът бъде изпълнен за `hh-1`, Q1 2026
- **THEN** fake stderr е точно `[bootstrap] STORAGE=memory` и `[bootstrap] PUBLISHER=txt REPORT_FILE=<файла>`, а файлът започва с `household hh-1 | 2026-01-01..2026-03-31` и завършва с `total | 14239.73` и празен ред

#### Scenario: REPORT_FILE по подразбиране
- **GIVEN** конфигурация без `REPORT_FILE`
- **WHEN** се определи файлът за отчети
- **THEN** той е `fee-reports.txt` в data папката (`DATA_DIR` или `data/` на проекта)

#### Scenario: Непознат PUBLISHER
- **GIVEN** `PUBLISHER=email` и събиращ fake stderr
- **WHEN** composition root-ът бъде извикан
- **THEN** хвърля синхронно със съобщение, съдържащо `PUBLISHER`, `email`, `console`, `txt`, а fake stderr е празен
