# Spec Delta

## MODIFIED Requirements

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

## ADDED Requirements

### Requirement: Скрипт pack създава архив hexa.tar.gz на проекта
`npm run pack` SHALL създаде `hexa.tar.gz` в корена на repo-то: gzip-нат
tar, в който всеки запис е под префикс `hexa/`, съдържащ всички файлове на
проекта без `.git/`, `node_modules/`, самия архив и файловете, които
`.gitignore` изключва. Скриптът SHALL използва само `node` и dev
зависимостите — без `tar`, `git` или друг външен процес.

#### Scenario: Архивът е копие без node_modules
- **GIVEN** проект след `npm install` с `README.md`
- **WHEN** се изпълни `npm run pack`
- **THEN** `hexa.tar.gz` съществува, всеки запис в него започва с `hexa/`, нито един не съдържа `node_modules/` или `.git/`, и `hexa/README.md`, `hexa/package.json`, `hexa/src/bootstrap/compose.ts`, `hexa/data/accounts.json` и `hexa/test/architecture.test.ts` са вътре

#### Scenario: Архивът се разархивира със стандартен tar
- **WHEN** получателят изпълни `tar -xzf hexa.tar.gz` на macOS или Linux
- **THEN** получава папка `hexa/`, в която `npm install && npm test` минава

#### Scenario: Повторно изпълнение
- **GIVEN** вече съществуващ `hexa.tar.gz`
- **WHEN** се изпълни `npm run pack` отново
- **THEN** архивът се презаписва и старият архив не е включен в новия

#### Scenario: Изходен път по избор
- **WHEN** скриптът се извика с аргумент път (`tsx scripts/pack-demo.ts /tmp/x/hexa.tar.gz`)
- **THEN** архивът се записва там, а не в корена на repo-то

#### Scenario: Архивът не влиза в git
- **WHEN** `hexa.tar.gz` съществува в корена
- **THEN** `git status` не го показва като нов файл — `.gitignore` го изключва
