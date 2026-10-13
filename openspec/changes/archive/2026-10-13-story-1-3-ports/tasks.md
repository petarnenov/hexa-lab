# Tasks

## 1. TASK-1.3.1 Inbound порт

- [x] 1.1 Сложи `status: in-progress` на `backlog/.../STORY-1.3.md` (само frontmatter); провери с `grep -rl '^status: in-progress' backlog`, че това е единственият елемент в работа.
- [x] 1.2 (SUB-1.3.1.1) Създай `test/ports.test.ts` с `describe("calculate-household-fees")`: fake `{ execute: async () => report } satisfies CalculateHouseholdFees`, който връща готов `FeeReport` (`buildFeeReport`); тест, че `execute` с команда `{ householdId: "hh-1", from: "2026-01-01", to: "2026-03-31" }` връща обект с `householdId/period/lines/total`; тест, че `await import(".../ports/in/CalculateHouseholdFees.ts")` има `Object.keys(...) = []`. Провери, че `npm test` пада заради липсващия модул.
- [x] 1.3 (SUB-1.3.1.1) Създай `src/application/ports/in/CalculateHouseholdFees.ts` по design.md D2/D3: `type CalculateHouseholdFeesCommand { householdId; from; to }` (низове, `readonly`) и `interface CalculateHouseholdFees { execute(command): Promise<FeeReport> }`, `import type` от `../../../domain/FeeReport.ts`; коментар защо датите са низове и защо `interface`. Провери, че тестовете от 1.2 минават.
- [x] 1.4 `npm run typecheck && npm test` минават.

## 2. TASK-1.3.2 Outbound портове

- [x] 2.1 (SUB-1.3.2.1) Добави в `test/ports.test.ts` `describe("outbound-ports")` с fake `AccountRepository` върху масив (`satisfies`): две сметки за `hh-1` → списък с тях; `hh-404` → `[]` без грешка; празен модул при dynamic import. Създай `src/application/ports/out/AccountRepository.ts` с `interface AccountRepository { findByHouseholdId(householdId: string): Promise<readonly Account[]> }` и коментар „липсващ household = празен списък; грешката е решение на use case-а“. Провери, че тестовете минават.
- [x] 2.2 (SUB-1.3.2.2) Добави тестове за fake `FeeScheduleRepository`: `standard` → тарифата; `vip` → `undefined`; празен модул. Създай `src/application/ports/out/FeeScheduleRepository.ts` с `interface FeeScheduleRepository { findById(id: string): Promise<FeeSchedule | undefined> }` и коментар по design.md D4. Провери, че тестовете минават.
- [x] 2.3 (SUB-1.3.2.3) Добави тестове за fake `FeeReportPublisher`, който записва отчетите в масив: след `publish(report)` масивът съдържа точно `report`, а резултатът е `undefined`; празен модул. Създай `src/application/ports/out/FeeReportPublisher.ts` с `interface FeeReportPublisher { publish(report: FeeReport): Promise<void> }` и коментар по design.md D5 (защо `Promise` дори за конзола). Провери, че тестовете минават.
- [x] 2.4 Добави тест „без технологични думи“: прочети трите outbound файла с `node:fs/promises` и провери, че `/file|json|sql|console|http/i` няма съвпадение; при нужда преформулирай коментарите в портовете. Провери, че `npm test` минава.
- [x] 2.5 Провери ръчно правилото за зависимостите (design.md D7): `grep -rn 'from "' src/application` показва само `import type` от `../../../domain/*.ts`; увери се, че всеки от четирите файла започва с обяснителен коментар кой го имплементира и кой го консумира.
- [x] 2.6 `npm run typecheck && npm test` минават.

## Workflow follow-up

- `/opsx:archive story-1-3-ports` — мърджва `calculate-household-fees` и `outbound-ports` в `openspec/specs/` и сменя status на STORY-1.3, TASK-1.3.x и SUB-1.3.x.y на `done`.
- `/commit`, после `/clear`.
