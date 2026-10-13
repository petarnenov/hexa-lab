# Spec Delta

## MODIFIED Requirements

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
