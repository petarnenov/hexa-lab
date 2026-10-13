# Tasks

## 1. TASK-1.5.3 test/architecture.test.ts

- [x] 1.1 Сложи `status: in-progress` на `backlog/.../STORY-1.5.md` (само frontmatter); провери с `grep -rl '^status: in-progress' backlog`, че това е единственият елемент в работа.
- [x] 1.2 (SUB-1.5.3.1) Създай `test/architecture.test.ts` с `describe("architecture-dependency-rule")` и първите тестове за парсера по spec „Всички import форми се разпознават“: синтетичен низ с `import { a } from "./a.ts"`, `export * from './b.ts'`, `import "./c.ts"`, `await import("./d.ts")`, `import type { T } from "./t.ts"` и ред `// import { z } from "./z.ts"` → `importSpecifiers` връща точно 5 specifier-а без `./z.ts`; блоков коментар `/* import "./w.ts" */` също не се брои. Провери, че `npm test` пада (функцията липсва).
- [x] 1.3 (SUB-1.5.3.1) Имплементирай `stripComments` и `importSpecifiers` по design.md D2 в същия файл; коментар над всеки regex коя форма лови и защо type-import-ите се броят. Провери, че тестовете от 1.2 минават.
- [x] 1.4 (SUB-1.5.3.2) Добави тестовете за `layerOf` и `violationsOf` по spec: `layerOf("application/ports/out/AccountRepository.ts") === "application"`, `layerOf("adapters/in/http.ts") === "adapters/in"`, `layerOf("util/helpers.ts") === undefined`; `violationsOf` върху `src/domain/x.ts → ../adapters/out/y.ts` дава 1 нарушение със съобщение, съдържащо файла, specifier-а, `domain` и `adapters/out`; `src/adapters/in/a.ts → ../out/b.ts` дава нарушение с `adapters/in` и `adapters/out`; `src/domain/x.ts → node:fs/promises` дава нарушение с `node:fs/promises` и `domain`; `src/util/h.ts → ./x.ts` дава нарушение „файл без слой“; позволени двойки (`application → ../domain/Account.ts`, `application/ports/out/AccountRepository.ts → ../../../domain/Account.ts`, `bootstrap → ../adapters/in/x.ts`, `adapters/in → node:http`, `adapters/out → ../../application/ports/out/AccountRepository.ts`) дават `[]`. Провери, че падат.
- [x] 1.5 (SUB-1.5.3.2) Имплементирай `ALLOWED`, `layerOf`, `resolve` и `violationsOf` по design.md D3/D4 с `path.posix`; коментар над таблицата сочи към `openspec/config.yaml` и обяснява защо адаптер не импортира адаптер. Провери, че тестовете от 1.4 минават.
- [x] 1.6 (SUB-1.5.3.2) Добави обхода по design.md D5: `walk("src")` → `Dependency[]` за всички `.ts` файлове; тест `"src/ obeys the dependency rule"` с `assert.deepEqual(violations, [], …)` и съобщение, което изброява всички нарушения ред по ред. Пусни `npm test` — трябва да минава върху днешния `src/`. Провери ръчно съобщението, като временно добавиш `import "../application/CalculateHouseholdFeesService.ts"` в `src/domain/errors.ts`, видиш формата `src/domain/errors.ts -> …: domain may not import application`, и върнеш файла.
- [x] 1.7 (SUB-1.5.3.3) Добави теста `"src/ has at least one import"` (`deps.length > 0`) по spec „Тестът доказва, че гледа реален код“ и коментар защо съществува (счупен парсер → 0 import-а → 0 нарушения → фалшиво зелено). Провери, че минава, и че временно подменен `importSpecifiers = () => []` го сваля.
- [x] 1.8 `npm run typecheck && npm test` минават.

## 2. TASK-1.5.1 test/domain.test.ts — ревизия на покритието

- [x] 2.1 (SUB-1.5.1.1) Сравни кейсовете за нивата (150k, 2.5M, 6M, точно 1M, AUM 0) с тестовете в `describe("annual marginal fee")`; добави тест за всеки липсващ кейс. Запиши картата кейс → тест в хедър-коментара на файла.
- [x] 2.2 (SUB-1.5.1.2) Същото за минимум (150k → 2 500 през `feeForPeriod`) и закръгляне (21 250 × 90/365 = 5 239.73; `roundToCents` половин цент нагоре/надолу/1.005). Увери се, че тестът за минимума ползва именно 150k.
- [x] 2.3 (SUB-1.5.1.3) Същото за периода (90 / 1 / 366 дни; `from > to`, `2026-02-30`, не-ISO формати).
- [x] 2.4 `npm run typecheck && npm test` минават.

## 3. TASK-1.5.2 test/calculate-fees.test.ts — ревизия на покритието

- [x] 3.1 (SUB-1.5.2.1) Потвърди успешния път: `hh-1` Q1 2026 → 3 реда, `total = 14239.73`, `publish` веднъж, `published[0] === result`. Добави, ако липсва; запиши картата в хедър-коментара.
- [x] 3.2 (SUB-1.5.2.2) Потвърди грешките: непознат household → `HouseholdNotFound`, липсваща тарифа → `FeeScheduleNotFound`, невалиден период → `InvalidBillingPeriod`, във всеки случай `published.length === 0`. Обнови коментара на guard теста „без инфраструктура“: вече не е „until architecture.test.ts“, а допълнение към него (съдържание vs. import-и).
- [x] 3.3 `npm run typecheck && npm test` минават.

## Workflow follow-up

- Sync docs: прегледай `design.md`, `proposal.md` и delta spec-а срещу реалния код (regex-ите, имената на функциите, формата на съобщението, резултата от ревизията в 2./3.) и поправи отклоненията с едно изречение *защо* в design.md; няма `README.md` още.
- `/opsx:archive story-1-5-tests` — създава `openspec/specs/architecture-dependency-rule/` и сменя status на STORY-1.5, TASK-1.5.x и SUB-1.5.x.y на `done`.
- `/commit`, после `/clear`.
