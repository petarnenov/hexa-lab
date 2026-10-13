# composition-root Specification

## Purpose

Определя единственото място, където конкретните адаптери се свързват с
портовете: как от конфигурацията на средата се сглобява готов use case,
кой storage се избира, откъде се четат данните и какво се случва при
непозната конфигурация — така че смяната на storage е смяна на една env
променлива, а не на код.

## Requirements

### Requirement: Composition root-ът връща готов inbound порт
Bootstrap слоят SHALL предоставя функция, която от конфигурация на средата
(`STORAGE`, `DATA_DIR`) връща стойност, изпълняваща inbound порта
`CalculateHouseholdFees`, сглобена от use case сервиза, двойка репозитории
според storage-а и console publisher към подадения stderr поток. Извикващият
SHALL получава само порта, не конкретните класове.

#### Scenario: Готов use case без ръчно сглобяване
- **GIVEN** празна конфигурация и събиращ fake stderr
- **WHEN** composition root-ът бъде извикан
- **THEN** резултатът има `execute`, и `execute({ householdId: "hh-1", from: "2026-01-01", to: "2026-03-31" })` връща отчет с `total 14239.73`, а fake stderr съдържа реда на publisher-а `[publish] household hh-1 …`

### Requirement: STORAGE избира storage, memory по подразбиране
Composition root-ът SHALL чете `STORAGE` от подадената конфигурация: липсваща
или празна стойност SHALL означава `memory`; `memory` SHALL сглобява in-memory
репозиториите със seed данните; `json` SHALL сглобява JSON-file
репозиториите върху `accounts.json` и `fee-schedules.json` в data папката.
Двата режима SHALL дават идентичен отчет за едни и същи данни.

#### Scenario: Липсващ STORAGE е memory
- **GIVEN** конфигурация без `STORAGE`
- **WHEN** composition root-ът бъде извикан и use case-ът изпълнен за `hh-1`, Q1 2026
- **THEN** отчетът има три реда (`acc-1`, `acc-2`, `acc-3`) и `total 14239.73`, без да се докосва файловата система за данни

#### Scenario: STORAGE=json чете data/
- **GIVEN** конфигурация `STORAGE=json` без `DATA_DIR`
- **WHEN** composition root-ът бъде извикан и use case-ът изпълнен за `hh-1`, Q1 2026
- **THEN** отчетът е deepEqual на отчета от memory режима, включително `total 14239.73`

#### Scenario: Непозната стойност е ясна грешка
- **GIVEN** конфигурация `STORAGE=sqlite`
- **WHEN** composition root-ът бъде извикан
- **THEN** хвърля грешка **синхронно**, преди да сглоби нещо, чието съобщение съдържа `STORAGE`, получената стойност `sqlite` и позволените `memory` и `json`

### Requirement: Избраният storage се логва на stderr
При успешен избор composition root-ът SHALL пише точно един ред
`[bootstrap] STORAGE=<memory|json>` в подадения stderr поток (по
подразбиране `process.stderr`) и SHALL не пише нищо на stdout. При
непозната стойност SHALL не пише лог ред — само грешката.

#### Scenario: Лог ред за memory
- **GIVEN** конфигурация без `STORAGE` и събиращ fake stderr
- **WHEN** composition root-ът бъде извикан
- **THEN** fake stderr съдържа реда `[bootstrap] STORAGE=memory`, а `process.stdout` не е докоснат

#### Scenario: Лог ред за json
- **GIVEN** конфигурация `STORAGE=json` и събиращ fake stderr
- **WHEN** composition root-ът бъде извикан
- **THEN** fake stderr съдържа реда `[bootstrap] STORAGE=json`

#### Scenario: Без лог при грешка
- **GIVEN** конфигурация `STORAGE=sqlite` и събиращ fake stderr
- **WHEN** composition root-ът хвърли
- **THEN** fake stderr е празен

### Requirement: Data папката е data/ на проекта, DATA_DIR я презаписва
В `json` режим composition root-ът SHALL използва папката `data/` в корена на
проекта, изведена от местоположението на bootstrap модула (не от текущата
работна директория), освен ако конфигурацията не съдържа непразен `DATA_DIR`
— тогава SHALL използва него. Файловете SHALL са `<папка>/accounts.json` и
`<папка>/fee-schedules.json`.

#### Scenario: Работната директория не влияе
- **GIVEN** `STORAGE=json` без `DATA_DIR`
- **WHEN** composition root-ът определи data папката
- **THEN** тя е абсолютен път, изведен от местоположението на bootstrap модула (завършва на `/data/`), и остава същата, когато `process.cwd()` е друга директория; use case-ът за `hh-1`, Q1 2026 дава `total 14239.73`

#### Scenario: DATA_DIR сочи към друга папка
- **GIVEN** временна папка с `accounts.json`, съдържащ само `acc-4` (`hh-2`, AUM 800000, `standard`), и `fee-schedules.json` копие на проектния, и конфигурация `STORAGE=json`, `DATA_DIR=<папката>`
- **WHEN** use case-ът бъде изпълнен за `hh-2`, Q1 2026
- **THEN** отчетът има един ред `acc-4`, а за `hh-1` хвърля `HouseholdNotFound`

#### Scenario: DATA_DIR без файлове
- **GIVEN** `STORAGE=json`, `DATA_DIR=<празна папка>`
- **WHEN** use case-ът бъде изпълнен
- **THEN** отхвърля с грешка, чието съобщение съдържа пътя `<папка>/accounts.json`; самото сглобяване не е хвърлило

### Requirement: Seed данните за memory съвпадат с data/*.json
Bootstrap SHALL предоставя seed данни (сметки и тарифи) за memory режима,
които SHALL са структурно идентични с `data/accounts.json` и
`data/fee-schedules.json`, и тест SHALL пази тази идентичност.

#### Scenario: Seed равен на файловете
- **GIVEN** seed сметките и тарифите от bootstrap
- **WHEN** се сравнят (deepEqual) с parse-натото съдържание на `data/accounts.json` и `data/fee-schedules.json`
- **THEN** са равни

#### Scenario: Разминаване се хваща
- **GIVEN** някой промени AUM на `acc-1` в `data/accounts.json` без да пипа seed-а
- **WHEN** се изпълни `npm test`
- **THEN** тестът за синхрон пада и назовава разликата

### Requirement: Само bootstrap импортира конкретни адаптери
Файловете на composition root-а SHALL са единственото място в `src/`, което
импортира класовете от `src/adapters/out/` и функциите от `src/adapters/in/`
заедно; никой друг слой SHALL не импортира `src/bootstrap/`.

#### Scenario: Архитектурният тест минава с bootstrap
- **GIVEN** `src/bootstrap/compose.ts` импортира сервиза, трите out адаптера и seed-а, а `cli.main.ts`/`http.main.ts` импортират in адаптерите и `compose.ts`
- **WHEN** се изпълни `npm test`
- **THEN** архитектурният тест не докладва нарушение
