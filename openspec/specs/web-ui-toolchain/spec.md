# web-ui-toolchain Specification

## Purpose

Определя как се стартира, тества и проверява `ui/` пакетът - отделният
browser клиент на hexa-lab - и как стига до HTTP адаптера, без да го променя.

## Requirements

### Requirement: UI пакетът е самостоятелен и не зависи от src/
`ui/` SHALL е отделен npm пакет със собствен `package.json` и lockfile.
Нито един файл в `ui/` MUST да не импортира файл от `src/`; `ui/` говори
със сървъра само по HTTP. Кореновият пакет SHALL остава без runtime зависимости.

#### Scenario: Инсталация на ui
- **GIVEN** чист checkout с Node 22+
- **WHEN** разработчик изпълни `cd ui && npm install`
- **THEN** инсталацията завършва успешно и кореновият `package.json` няма секция `dependencies`

#### Scenario: Опит за импорт от src
- **WHEN** файл в `ui/src/` импортира `../../src/domain/FeeReport.ts`
- **THEN** ревюто го отхвърля; `ui/` познава само JSON договора на HTTP адаптера

### Requirement: Dev сървърът proxy-ва /households към HTTP адаптера
`cd ui && npm run dev` SHALL стартира dev сървър, който сервира страницата
и препраща всяка заявка с път, започващ с `/households`, към
`http://localhost:<PORT>`, където `PORT` е същата променлива като на
`npm run http` (по подразбиране 3000). HTTP адаптерът SHALL да не получава
CORS или други промени заради UI-я.

#### Scenario: Заявка през proxy
- **GIVEN** `npm run http` работи на порт 3000 и `cd ui && npm run dev` работи
- **WHEN** страницата изпълни `POST /households/hh-1/fees` с тяло `{"from":"2026-01-01","to":"2026-03-31"}`
- **THEN** отговорът е JSON отчет с `total: 14239.73`, same-origin, без CORS грешка

#### Scenario: Друг порт на backend-а
- **GIVEN** `PORT=3001 npm run http`
- **WHEN** `PORT=3001 npm run ui`
- **THEN** заявките към `/households/*` стигат до порт 3001

#### Scenario: Backend не работи
- **GIVEN** `npm run http` не е стартиран
- **WHEN** страницата изпълни `POST /households/hh-1/fees`
- **THEN** proxy-то връща грешка (5xx), а dev сървърът продължава да работи

### Requirement: Скрипт test изпълнява UI тестовете в DOM среда
`cd ui && npm test` SHALL изпълни еднократно (без watch) всеки файл
`ui/src/**/*.test.tsx` в симулирана DOM среда с матчъри за DOM
(`toBeInTheDocument` и т.н.) и SHALL завършва с ненулев код при неуспешен тест.

#### Scenario: Всички тестове минават
- **WHEN** всички `*.test.tsx` файлове минават
- **THEN** `cd ui && npm test` завършва с код 0 и отчита броя тестове

#### Scenario: Неуспешен тест
- **WHEN** тест assert-ва елемент, който не е рендериран
- **THEN** `cd ui && npm test` завършва с ненулев код и показва името на теста

#### Scenario: Нов тестов файл се открива автоматично
- **WHEN** разработчик добави `ui/src/FeeForm.test.tsx`
- **THEN** `cd ui && npm test` го изпълнява без промяна на конфигурация

### Requirement: Скрипт typecheck проверява ui/ в strict режим без emit
`cd ui && npm run typecheck` SHALL проверява всички `.ts`/`.tsx` файлове в
`ui/src/` и `ui/vite.config.ts` в strict режим с JSX, без да генерира
файлове. Кореновият `npm run typecheck` SHALL да не вижда `ui/`.

#### Scenario: Чист ui
- **WHEN** `ui/src/` няма грешки в типовете
- **THEN** `cd ui && npm run typecheck` завършва с код 0 и не създава `.js`/`.d.ts`

#### Scenario: Грешка в типовете в ui
- **WHEN** `.tsx` файл присвоява `string` на `number`
- **THEN** `cd ui && npm run typecheck` завършва с ненулев код и сочи файла и реда

#### Scenario: Кореновият typecheck е независим
- **WHEN** `ui/src/` съдържа грешка в типовете
- **THEN** кореновият `npm run typecheck` минава с код 0

### Requirement: Генерираните файлове на ui не влизат в git и в архива
`ui/node_modules/` и `ui/dist/` SHALL са игнорирани от git. `npm run pack`
SHALL да не включва `ui/node_modules/`.

#### Scenario: git status след install
- **WHEN** `cd ui && npm install` е изпълнен
- **THEN** `git status --porcelain` не показва `ui/node_modules/`, а `ui/package-lock.json` е проследен

#### Scenario: pack без ui/node_modules
- **WHEN** се изпълни `npm run pack` след `cd ui && npm install`
- **THEN** `tar -tzf hexa.tar.gz` съдържа `hexa/ui/package.json` и не съдържа запис под `hexa/ui/node_modules/`
