# Spec Delta

## ADDED Requirements

### Requirement: Слоевете в src/ се определят по път
Всеки `.ts` файл под `src/` SHALL принадлежи на точно един слой според първите
сегменти на пътя му спрямо `src/`: `domain`, `application`, `adapters/in`,
`adapters/out` или `bootstrap`. Файл извън тези пет SHALL се докладва като
нарушение („файл без слой“), не SHALL се подминава мълчаливо.

#### Scenario: Файл в познат слой
- **GIVEN** файлът `src/application/ports/out/AccountRepository.ts`
- **WHEN** архитектурният тест определя слоя му
- **THEN** слоят е `application`

#### Scenario: Файл извън слоевете
- **GIVEN** файлът `src/util/helpers.ts`
- **WHEN** архитектурният тест го срещне
- **THEN** тестът пада със съобщение, което съдържа `src/util/helpers.ts` и казва, че файлът не е в никой слой

### Requirement: Таблица с позволени зависимости между слоевете
Архитектурният тест SHALL позволява import само по таблицата:
`domain → domain`; `application → domain, application`;
`adapters/in → domain, application`; `adapters/out → domain, application`;
`bootstrap → domain, application, adapters/in, adapters/out, bootstrap`.
Всеки друг относителен import между файлове в `src/` SHALL е нарушение,
както и относителен import, който излиза извън `src/`.

#### Scenario: Application вижда domain
- **GIVEN** `src/application/CalculateHouseholdFeesService.ts` импортира `../domain/FeeReport.ts`
- **WHEN** се изпълни `npm test`
- **THEN** архитектурният тест не докладва нарушение за този import

#### Scenario: Domain посяга към application
- **GIVEN** файл в `src/domain/` импортира `../application/ports/out/AccountRepository.ts`
- **WHEN** се изпълни `npm test`
- **THEN** архитектурният тест пада със съобщение, което съдържа пътя на файла, specifier-а и думите `domain` и `application`

#### Scenario: Driving адаптер посяга към driven адаптер
- **GIVEN** файл в `src/adapters/in/` импортира файл от `src/adapters/out/`
- **WHEN** се изпълни `npm test`
- **THEN** архитектурният тест пада и съобщението назовава `adapters/in` и `adapters/out`

#### Scenario: Bootstrap вижда всичко
- **GIVEN** файл в `src/bootstrap/` импортира файлове от `domain`, `application`, `adapters/in` и `adapters/out`
- **WHEN** се изпълни `npm test`
- **THEN** архитектурният тест не докладва нарушение за тези import-и

### Requirement: Външни модули са позволени само в адаптерите и bootstrap
Import на неотносителен specifier (`node:*`, пакет) SHALL е нарушение във
файлове от `domain` и `application` и SHALL е позволен във `adapters/in`,
`adapters/out` и `bootstrap`.

#### Scenario: Domain импортира node:fs
- **GIVEN** файл в `src/domain/` съдържа `import { readFile } from "node:fs/promises"`
- **WHEN** се изпълни `npm test`
- **THEN** архитектурният тест пада и съобщението съдържа `node:fs/promises` и `domain`

#### Scenario: Адаптер импортира node:http
- **GIVEN** файл в `src/adapters/in/` съдържа `import { createServer } from "node:http"`
- **WHEN** се изпълни `npm test`
- **THEN** архитектурният тест не докладва нарушение за този import

### Requirement: Всички import форми се разпознават, коментарите не
Парсерът SHALL открива specifier-а в `import … from "x"` (включително
`import type`), `export … from "x"`, `import "x"` и `import("x")` (с единични
или двойни кавички), SHALL резолвира относителните specifier-и спрямо папката
на файла и SHALL игнорира import-и, които се намират в `//` или `/* */`
коментар.

#### Scenario: Синтетичен код с всички форми
- **GIVEN** низ, съдържащ `import { a } from "./a.ts"`, `export * from './b.ts'`, `import "./c.ts"`, `await import("./d.ts")`, `import type { T } from "./t.ts"`, ред `// import { z } from "./z.ts"` и блок `/* import "./w.ts" */`
- **WHEN** парсерът се извика върху низа
- **THEN** връща точно `./a.ts`, `./b.ts`, `./c.ts`, `./d.ts`, `./t.ts` в този ред и не връща `./z.ts` и `./w.ts`

#### Scenario: Относителен път се резолвира спрямо файла
- **GIVEN** файлът `src/application/ports/out/AccountRepository.ts` импортира `../../../domain/Account.ts`
- **WHEN** парсерът резолвира specifier-а
- **THEN** целта е `domain/Account.ts` спрямо `src/`, т.е. слой `domain`

### Requirement: Тестът доказва, че гледа реален код
Архитектурният тест SHALL пада, ако в `src/` не е намерен нито един import,
и SHALL проверява върху синтетично нарушение, че проверката на правилата
връща нарушение с четимо съобщение — за да не може да „минава“ заради счупен
парсер.

#### Scenario: Нула намерени import-а
- **GIVEN** парсер, който (поради бъг) не намира нищо в `src/`
- **WHEN** се изпълни `npm test`
- **THEN** архитектурният тест пада със съобщение, че не е открит нито един import

#### Scenario: Синтетично нарушение
- **GIVEN** списък с една зависимост `src/domain/x.ts → ../adapters/out/y.ts`, подаден директно на проверката на правилата
- **WHEN** проверката се изпълни
- **THEN** връща точно едно нарушение, чието съобщение съдържа `src/domain/x.ts`, `../adapters/out/y.ts`, `domain` и `adapters/out`

### Requirement: Всички нарушения се докладват наведнъж
Тестът SHALL събира всички нарушения от целия `src/` и SHALL пада веднъж със
съобщение, което ги изброява ред по ред, вместо да спира на първото.

#### Scenario: Две нарушения в два файла
- **GIVEN** `src/` с нарушение в `domain/a.ts` и нарушение в `adapters/in/b.ts`
- **WHEN** се изпълни `npm test`
- **THEN** архитектурният тест пада веднъж и съобщението съдържа и двата файла
