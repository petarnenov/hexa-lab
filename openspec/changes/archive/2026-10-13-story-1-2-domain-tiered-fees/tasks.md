# Tasks

## 1. TASK-1.2.1 Типове Account, FeeSchedule, BillingPeriod

- [x] 1.1 Сложи `status: in-progress` на `backlog/.../STORY-1.2.md` (само frontmatter); провери с `grep -rl '^status: in-progress' backlog`, че това е единственият елемент в работа.
- [x] 1.2 (SUB-1.2.3.2, изтеглен напред — нужен на BillingPeriod) Напиши в `test/domain.test.ts` `describe("domain-errors")` с тестовете от spec-а (instanceof DomainError/Error, различни `code`, `name` = име на класа, `householdId`/`feeScheduleId` в грешката и в message); създай `src/domain/errors.ts` по design.md D6 с коментари; провери, че тестовете минават.
- [x] 1.3 (SUB-1.2.1.1) Създай `src/domain/Account.ts` с `type Account = { id; householdId; name; aum; feeScheduleId }` и коментар какво е AUM; провери с `npm run typecheck`.
- [x] 1.4 (SUB-1.2.1.2) Създай `src/domain/FeeSchedule.ts` с `FeeTier { upTo: number | null; annualRateBps: number }` и `FeeSchedule { id; name; tiers; minimumAnnualFee }`, коментар за bps и `null = без горна граница`; провери с `npm run typecheck`.
- [x] 1.5 (SUB-1.2.1.3) Добави `describe("billing-period")` в `test/domain.test.ts` с тестовете от spec-а (валиден период, `2026-02-30`, три не-ISO формата, `from > to`, еднакви дати, 90/1/366 дни); създай `src/domain/BillingPeriod.ts` по design.md D5 (`createBillingPeriod`, `daysInPeriod`, тип `IsoDate`); провери, че тестовете минават.
- [x] 1.6 `npm run typecheck && npm test` минават.

## 2. TASK-1.2.2 tieredFee.ts

- [x] 2.1 (SUB-1.2.2.2) Добави в `test/domain.test.ts` `describe("tiered-fee-calculation")` с фикстура `standard` (1M @ 100, 5M @ 75, null @ 50, минимум 2 500) и тестовете за валидация (валидна, без нива, невъзходящи, `null` не последно, еднакви граници → `InvalidFeeSchedule`); създай `src/domain/tieredFee.ts` с `validateFeeSchedule` по design.md D4; провери, че тестовете минават.
- [x] 2.2 (SUB-1.2.2.1) Добави тестовете за годишна такса (150k → 1 500, 2.5M → 21 250, 6M → 45 000, 1M → 10 000, 0 → 0, невалидна тарифа → `InvalidFeeSchedule`); имплементирай `annualTieredFee` по design.md D3 с коментар, който обяснява marginal облагането; провери, че тестовете минават.
- [x] 2.3 (SUB-1.2.2.3) Добави тестовете за `roundToCents` (5 239.725 → 5 239.73, 1.005 → 1.01, 58.2191 → 58.22) и за `feeForPeriod` (150k × 365 дни → 2 500; 2.5M × Q1 2026 → 5 239.73; 1 ден → 58.22; 366 дни → 21 308.22); имплементирай `roundToCents` и `feeForPeriod` по design.md D2; провери, че тестовете минават.
- [x] 2.4 `npm run typecheck && npm test` минават.

## 3. TASK-1.2.3 FeeReport и грешки

- [x] 3.1 (SUB-1.2.3.1) Добави `describe("fee-report")` в `test/domain.test.ts` (два реда 5 239.73 + 9 000 → `total 14 239.73`, запазени householdId/период/ред на редовете; 0.10 + 0.20 → точно 0.30; без редове → `total 0`); създай `src/domain/FeeReport.ts` с `FeeLine`, `FeeReport`, `buildFeeReport` по design.md D7; провери, че тестовете минават.
- [x] 3.2 (SUB-1.2.3.2) Прегледай `src/domain/errors.ts` от задача 1.2 срещу spec `domain-errors` и design D6 (четири различни `code`, съобщения съдържат стойността); допълни коментарите; провери с `npm test`.
- [x] 3.3 Провери ръчно правилото за зависимостите: `grep -rn "from \"" src/domain` показва само import-и от `./*.ts`, без `node:` и без други слоеве; увери се, че всеки файл в `src/domain/` има обяснителен коментар в началото.
- [x] 3.4 `npm run typecheck && npm test` минават.

## Workflow follow-up

- `/opsx:archive story-1-2-domain-tiered-fees` — мърджва четирите spec-а в `openspec/specs/` и сменя status на STORY-1.2, TASK-1.2.x и SUB-1.2.x.y на `done`.
- `/commit`, после `/clear`.
