# project-toolchain Specification

## Purpose

Определя npm скриптовете и ограниченията на toolchain-а, на които разчита
целият проект: как се пускат entry point-ите, тестовете и проверката на
типовете, еднакво на macOS и Linux.

## Requirements

### Requirement: Проектът е ESM TypeScript пакет без runtime зависимости
Пакетът SHALL е с `"type": "module"`, SHALL декларира `engines.node >= 22` и
SHALL има само dev зависимости `typescript`, `tsx` и `@types/node`. Секция
`dependencies` MUST да отсъства или да е празна.

#### Scenario: Инсталация на чист checkout
- **WHEN** разработчик изпълни `npm install` на чист checkout с Node 22+
- **THEN** инсталацията завършва успешно и в `node_modules/` няма пакети извън
  трите dev зависимости и техните транзитивни зависимости

#### Scenario: Опит за runtime зависимост
- **WHEN** в `package.json` се появи непразна секция `dependencies`
- **THEN** това е нарушение на правилото на проекта и ревюто го отхвърля

### Requirement: Скрипт typecheck проверява типовете без emit
`npm run typecheck` SHALL проверява всички `.ts` файлове в `src/`, `test/` и
`scripts/` в strict режим, SHALL да не генерира изходни файлове и SHALL да
завършва с код 0 при проект без грешки, включително когато `src/` е празен.

#### Scenario: Празен src
- **WHEN** `src/` не съдържа файлове и се изпълни `npm run typecheck`
- **THEN** командата завършва с код 0 и не създава `.js`, `.d.ts` или
  `dist/` файлове

#### Scenario: Грешка в типовете
- **WHEN** файл в `src/`, `test/` или `scripts/` присвоява `string` на
  променлива от тип `number`
- **THEN** `npm run typecheck` завършва с ненулев код и съобщава файла и реда

#### Scenario: Import с .ts разширение
- **WHEN** файл импортира друг модул с `./x.ts` разширение
- **THEN** `npm run typecheck` приема import-а без грешка

### Requirement: Скрипт test изпълнява всички test/*.test.ts с node:test
`npm test` SHALL изпълнява всеки файл `test/*.test.ts` директно като
TypeScript (без предварителна компилация) с вградения `node:test` runner и
SHALL завършва с ненулев код, ако поне един тест е неуспешен.

#### Scenario: Всички тестове минават
- **WHEN** всички файлове `test/*.test.ts` съдържат само успешни тестове
- **THEN** `npm test` завършва с код 0 и отчита броя изпълнени тестове

#### Scenario: Неуспешен тест
- **WHEN** някой `test/*.test.ts` съдържа неуспешен `assert`
- **THEN** `npm test` завършва с ненулев код и показва името на теста

#### Scenario: Нов тестов файл се открива автоматично
- **WHEN** разработчик добави нов файл `test/foo.test.ts`
- **THEN** `npm test` го изпълнява без промяна на `package.json`

### Requirement: Скриптове cli и http стартират bootstrap entry point-ите
`npm run cli` SHALL стартира `src/bootstrap/cli.main.ts`, а `npm run http`
SHALL стартира `src/bootstrap/http.main.ts`, и двата директно като
TypeScript през `tsx`. Допълнителни аргументи след `--` SHALL се предават на
entry point-а.

#### Scenario: Предаване на аргументи
- **WHEN** разработчик изпълни `npm run cli -- hh-1 2026-Q1`
- **THEN** `src/bootstrap/cli.main.ts` получава `hh-1` и `2026-Q1` в
  `process.argv`

#### Scenario: Entry point още не съществува
- **WHEN** `src/bootstrap/cli.main.ts` липсва (преди STORY-1.8)
- **THEN** `npm run cli` завършва с ненулев код и грешка за липсващ модул, без
  да повреди нищо друго

### Requirement: Скриптовете са преносими между macOS и Linux
Всички npm скриптове SHALL използват само команди, налични чрез `node`, `npm`
и dev зависимостите, без shell-специфичен синтаксис, който се държи различно
на macOS (BSD) и Linux (GNU).

#### Scenario: Еднакво поведение на двете ОС
- **WHEN** `npm run typecheck` и `npm test` се изпълнят на macOS и на Linux
  върху един и същ commit
- **THEN** резултатът (код на изход и набор изпълнени тестове) е еднакъв

### Requirement: Скрипт pack създава архив hexa.tar.gz на проекта
`npm run pack` SHALL създаде `hexa.tar.gz` в корена на repo-то: gzip-нат
tar, в който всеки запис е под префикс `hexa/`, съдържащ всички файлове на
проекта - включително пакета `ui/` - без `.git/`, `node_modules/` (на
всяко ниво), `ui/dist/`, самия архив и файловете, които `.gitignore`
изключва. Скриптът SHALL използва само `node` и dev зависимостите - без
`tar`, `git` или друг външен процес.

#### Scenario: Архивът е копие без node_modules
- **GIVEN** проект след `npm install` с `README.md`
- **WHEN** се изпълни `npm run pack`
- **THEN** `hexa.tar.gz` съществува, всеки запис в него започва с `hexa/`, нито един не съдържа `node_modules/` или `.git/`, и `hexa/README.md`, `hexa/package.json`, `hexa/src/bootstrap/compose.ts`, `hexa/data/accounts.json` и `hexa/test/architecture.test.ts` са вътре

#### Scenario: Пакетът ui/ е в архива без генерираните си папки
- **GIVEN** проект след `cd ui && npm install` и със съществуваща папка `ui/dist/`
- **WHEN** се изпълни `npm run pack`
- **THEN** `hexa/ui/package.json`, `hexa/ui/package-lock.json`, `hexa/ui/vite.config.ts` и `hexa/ui/src/App.tsx` са вътре, а нито един запис не започва с `hexa/ui/node_modules/` или `hexa/ui/dist/`

#### Scenario: Архивът се разархивира със стандартен tar
- **WHEN** получателят изпълни `tar -xzf hexa.tar.gz` на macOS или Linux
- **THEN** получава папка `hexa/`, в която `npm install && npm test && (cd ui && npm install && npm test)` минава

#### Scenario: Повторно изпълнение
- **GIVEN** вече съществуващ `hexa.tar.gz`
- **WHEN** се изпълни `npm run pack` отново
- **THEN** архивът се презаписва и старият архив не е включен в новия

#### Scenario: Изходен път по избор
- **WHEN** скриптът се извика с аргумент път (`tsx scripts/pack-demo.ts /tmp/x/hexa.tar.gz`)
- **THEN** архивът се записва там, а не в корена на repo-то

#### Scenario: Архивът не влиза в git
- **WHEN** `hexa.tar.gz` съществува в корена
- **THEN** `git status` не го показва като нов файл - `.gitignore` го изключва
### Requirement: Скриптове ui и ui:test делегират към пакета ui/
Кореновият `package.json` SHALL има скриптове `ui` и `ui:test`, които
изпълняват съответно `dev` и `test` на пакета `ui/` чрез `npm --prefix ui`,
без да добавят зависимости в кореновия пакет. Правилото „без runtime
зависимости“ SHALL важи за кореновия `package.json`; `ui/` е отделен пакет
със собствени зависимости.

#### Scenario: Старт на UI от корена
- **GIVEN** `cd ui && npm install` е изпълнен
- **WHEN** разработчик изпълни `npm run ui` от корена
- **THEN** стартира Vite dev сървърът на `ui/`

#### Scenario: UI тестове от корена
- **WHEN** разработчик изпълни `npm run ui:test` от корена
- **THEN** се изпълняват тестовете на `ui/` и кодът на изход е техният

#### Scenario: Кореновият npm test не е засегнат
- **WHEN** разработчик изпълни `npm test` от корена
- **THEN** се изпълняват само `test/*.test.ts` с `node:test`, без UI тестовете
