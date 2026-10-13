# Spec Delta

## Purpose

Определя npm скриптовете и ограниченията на toolchain-а, на които разчита
целият проект: как се пускат entry point-ите, тестовете и проверката на
типовете, еднакво на macOS и Linux.

## ADDED Requirements

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
`npm run typecheck` SHALL проверява всички `.ts` файлове в `src/` и `test/` в
strict режим, SHALL да не генерира изходни файлове и SHALL да завършва с код 0
при проект без грешки, включително когато `src/` е празен.

#### Scenario: Празен src
- **WHEN** `src/` не съдържа файлове и се изпълни `npm run typecheck`
- **THEN** командата завършва с код 0 и не създава `.js`, `.d.ts` или
  `dist/` файлове

#### Scenario: Грешка в типовете
- **WHEN** файл в `src/` или `test/` присвоява `string` на променлива от тип
  `number`
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
