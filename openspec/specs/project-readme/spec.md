# project-readme Specification

## Purpose

Определя какво съдържа `README.md` на проекта — входната точка за обучаващия
се: хексагонът, свързан с реалните папки, как се стартира и как се сменя
storage, очакваният изход на демото и упражненията за самостоятелна работа.

## Requirements

### Requirement: README свързва хексагона с реалните папки
`README.md` SHALL съдържа ASCII диаграма на хексагона, в която driving
адаптерите, inbound портът, use case-ът, domain-ът, outbound портовете,
driven адаптерите и composition root-ът са надписани с реалните пътища в
`src/`, а клиентите на driving адаптерите - терминалът, `curl` и браузърът
(`ui/`) - са показани извън хексагона; и SHALL формулира правилото за
зависимостите, кой тест го пази, и че `ui/` е извън слоевете.

#### Scenario: Всяка папка-слой е в диаграмата
- **GIVEN** папките `src/domain/`, `src/application/`, `src/adapters/in/`, `src/adapters/out/`, `src/bootstrap/`
- **WHEN** читател погледне диаграмата в README
- **THEN** всяка от петте папки се появява като надпис на кутия или ръб, а посоката на стрелките съвпада с правилото „domain ← application ← adapters ← bootstrap“

#### Scenario: Правилото за зависимостите е назовано
- **WHEN** читател прочете секцията за хексагона
- **THEN** вижда кой слой какво може да импортира и че `test/architecture.test.ts` го проверява при `npm test`

#### Scenario: Браузърът е клиент, не слой
- **WHEN** читател погледне диаграмата
- **THEN** вижда `browser (ui/)` и `curl` над `createHttpServer.ts`, извън хексагона, и бележка при таблицата на слоевете, че `ui/` е отделен пакет, който не импортира `src/` и `test/architecture.test.ts` не го гледа
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
CLI (таблица и `--json`) и през HTTP (`curl`), с `14239.73` като total, SHALL
отбелязва, че memory и json дават байт за байт същия JSON, и SHALL показва
браузъра като пети начин към същото число (демо „same total, five ways“).

#### Scenario: Изходът в README съвпада с реалния
- **WHEN** разработчик изпълни `npm run cli -- hh-1 2026-01-01 2026-03-31`
- **THEN** таблицата на stdout е същата като в README, включително `TOTAL … 14239.73`

#### Scenario: 404 примерът
- **WHEN** разработчик изпълни `curl` заявката за несъществуващ household от README
- **THEN** отговорът е `404` с `HOUSEHOLD_NOT_FOUND`, както README го показва

#### Scenario: Петият начин е браузърът
- **WHEN** читател стигне до демото
- **THEN** вижда, че при работещи `npm run http` и `npm run ui` страницата показва същите три реда и total `14,239.73` като CLI и `curl`, и че сървърът е същият процес
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
`npm run http`, `cd ui && npm install`, `npm run ui`, `npm run ui:test`,
адреса `localhost:5173`, променливите `STORAGE=json`, `DATA_DIR`, `PORT`,
низовете `14239.73` и `HOUSEHOLD_NOT_FOUND`, и точно пет линка към
`STORY-2.1`–`STORY-2.5` (по един).

#### Scenario: README е непълно
- **WHEN** някой махне секцията с упражнения или преименува слой без да обнови README
- **THEN** `npm test` пада с тест, чието име казва какво липсва в README

#### Scenario: README е пълно
- **WHEN** README съдържа всичко изброено
- **THEN** тестът минава и не изисква конкретен ред или формулировка извън изброените низове

#### Scenario: UI секцията липсва
- **WHEN** някой махне секцията UI от README
- **THEN** `npm test` пада с тест, чието име казва, че липсват командите за UI

### Requirement: README описва UI-я като отделен клиент
`README.md` SHALL има секция за UI-я с `cd ui && npm install`, старт на
backend-а (`npm run http`) и на UI-я (`npm run ui`) в два терминала,
адреса `http://localhost:5173`, какво прави dev proxy-то (`/households` →
HTTP адаптера на `PORT`, без CORS в сървъра), `npm run ui:test`, и SHALL
казва, че `ui/` е отделен пакет, който не импортира `src/`.

#### Scenario: Командите за UI работят копирани едно към едно
- **GIVEN** чист checkout с Node 22+ и `npm install` в корена
- **WHEN** разработчик изпълни командите от секцията UI в дадения ред
- **THEN** страницата на `http://localhost:5173` показва отчета за `hh-1` с total `14,239.73`, а `npm run ui:test` минава

#### Scenario: Друг порт на Vite
- **WHEN** читател потърси как да пусне UI-я на порт, различен от 5173
- **THEN** README дава команда, която реално стига до Vite (`npm run ui -- -- --port <n>` или `cd ui && npm run dev -- --port <n>`), а не `npm run ui -- --port <n>`

#### Scenario: Proxy-то е обяснено
- **WHEN** читател прочете секцията UI
- **THEN** разбира, че браузърът вика `/households/...` на своя origin, Vite го препраща към `localhost:<PORT>`, и че `createHttpServer.ts` не знае за UI-я
