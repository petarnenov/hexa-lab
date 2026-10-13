# Spec Delta

## Purpose

Определя какво съдържа `README.md` на проекта — входната точка за обучаващия
се: хексагонът, свързан с реалните папки, как се стартира и как се сменя
storage, очакваният изход на демото и упражненията за самостоятелна работа.

## ADDED Requirements

### Requirement: README свързва хексагона с реалните папки
`README.md` SHALL съдържа ASCII диаграма на хексагона, в която driving
адаптерите, inbound портът, use case-ът, domain-ът, outbound портовете,
driven адаптерите и composition root-ът са надписани с реалните пътища в
`src/`, и SHALL формулира правилото за зависимостите и кой тест го пази.

#### Scenario: Всяка папка-слой е в диаграмата
- **GIVEN** папките `src/domain/`, `src/application/`, `src/adapters/in/`, `src/adapters/out/`, `src/bootstrap/`
- **WHEN** читател погледне диаграмата в README
- **THEN** всяка от петте папки се появява като надпис на кутия или ръб, а посоката на стрелките съвпада с правилото „domain ← application ← adapters ← bootstrap“

#### Scenario: Правилото за зависимостите е назовано
- **WHEN** читател прочете секцията за хексагона
- **THEN** вижда кой слой какво може да импортира и че `test/architecture.test.ts` го проверява при `npm test`

### Requirement: README дава инструкции за стартиране и смяна на storage
`README.md` SHALL описва `npm install`, `npm test`, `npm run typecheck`,
`npm run cli -- <householdId> <from> <to> [--json]` и `npm run http` с
`curl` заявка за успех и за 404, и SHALL обяснява env променливите
`STORAGE` (`memory` по подразбиране, `json`), `DATA_DIR` и `PORT`.

#### Scenario: Командите се изпълняват както са написани
- **GIVEN** чист checkout с Node 22+ и `npm install`
- **WHEN** разработчик изпълни командите от README в дадения ред
- **THEN** всяка команда завършва така, както README казва, без допълнителни стъпки

#### Scenario: Смяната на storage е една env променлива
- **WHEN** читател потърси как да мине от memory към json
- **THEN** README показва `STORAGE=json npm run cli -- …` и `STORAGE=json npm run http`, и казва, че `src/` не се променя

### Requirement: README показва очаквания изход на демото
`README.md` SHALL съдържа реалния изход на `hh-1 2026-01-01 2026-03-31` през
CLI (таблица и `--json`) и през HTTP (`curl`), с `14239.73` като total, и
SHALL отбелязва, че memory и json дават байт за байт същия JSON.

#### Scenario: Изходът в README съвпада с реалния
- **WHEN** разработчик изпълни `npm run cli -- hh-1 2026-01-01 2026-03-31`
- **THEN** таблицата на stdout е същата като в README, включително `TOTAL … 14239.73`

#### Scenario: 404 примерът
- **WHEN** разработчик изпълни `curl` заявката за несъществуващ household от README
- **THEN** отговорът е `404` с `HOUSEHOLD_NOT_FOUND`, както README го показва

### Requirement: README изброява упражненията от EPIC-2 като описания
`README.md` SHALL има секция с упражнения, в която петте истории от EPIC-2
са описани с по едно изречение „какво“ и по една подсказка, с линк към
съответния `STORY-2.x` в `backlog/`, и SHALL не съдържа решения.

#### Scenario: Пет упражнения, пет линка
- **WHEN** читател отвори секцията с упражнения
- **THEN** вижда точно пет упражнения (SQLite адаптер, MCP driving адаптер, порт Clock, use case preview, счупи правилото) и всяко има линк към `backlog/EPIC-2-exercises/STORY-2.x-…/STORY-2.x.md`

#### Scenario: Само описания
- **WHEN** читател прочете едно упражнение
- **THEN** намира целта и подсказката, но не и готов код

### Requirement: Съдържанието на README се пази от тест
Проектът SHALL има тест, който проверява, че `README.md` съществува и че
споменава петте папки-слоеве, `test/architecture.test.ts`, командите
`npm install`, `npm test`, `npm run typecheck`, `npm run cli`,
`npm run http`, променливите `STORAGE=json`, `DATA_DIR`, `PORT`, низовете
`14239.73` и `HOUSEHOLD_NOT_FOUND`, и точно пет линка към
`STORY-2.1`–`STORY-2.5` (по един).

#### Scenario: README е непълно
- **WHEN** някой махне секцията с упражнения или преименува слой без да обнови README
- **THEN** `npm test` пада с тест, чието име казва какво липсва в README

#### Scenario: README е пълно
- **WHEN** README съдържа всичко изброено
- **THEN** тестът минава и не изисква конкретен ред или формулировка извън изброените низове
