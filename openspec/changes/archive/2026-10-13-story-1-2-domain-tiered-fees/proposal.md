# Proposal

## Why

Toolchain-ът е готов (STORY-1.1), но `src/` е празен. Ядрото на хексагона е
domain слоят — чиста, синхронна логика без I/O, върху която стъпват портовете
(STORY-1.3), use case-ът (STORY-1.4) и всички адаптери. Той трябва да е първи,
за да може всичко останало да се тества срещу фиксираните числа от блупринта.

## What Changes

- Нова папка `src/domain/` с типовете `Account`, `FeeSchedule` (+ `FeeTier`),
  `BillingPeriod` и конструктор `createBillingPeriod` с валидация на ISO дати
  и `from <= to`; `daysInPeriod` брои включително по UTC.
- Нов модул `tieredFee.ts`: валидация на тарифа (`validateFeeSchedule`),
  marginal годишна такса (`annualTieredFee`), пропорционална такса за период с
  минимум и закръгляне (`feeForPeriod`, `roundToCents`).
- Нов модул `FeeReport.ts`: `FeeLine`, `FeeReport`, `buildFeeReport`, който
  сумира вече закръглените редове.
- Нов модул `errors.ts`: базов `DomainError` и `InvalidBillingPeriod`,
  `InvalidFeeSchedule`, `HouseholdNotFound`, `FeeScheduleNotFound`.
- Нов `test/domain.test.ts`, който фиксира числата от блупринта: 150k → 1 500
  (преди минимум) и 2 500 (с минимум), 2.5M → 21 250, 6M → 45 000, 21 250 ×
  90/365 = 5 239.73, граници и грешки на периода. Проектното правило е „тест
  преди код“, затова тестът влиза тук, а STORY-1.5 го допълва с останалите
  кейсове.

## Покрити backlog елементи

- STORY-1.2 Domain: tiered такси
  - TASK-1.2.1 Типове Account, FeeSchedule, BillingPeriod
    - SUB-1.2.1.1 Account.ts
    - SUB-1.2.1.2 FeeSchedule.ts
    - SUB-1.2.1.3 BillingPeriod.ts
  - TASK-1.2.2 tieredFee.ts
    - SUB-1.2.2.1 annualTieredFee
    - SUB-1.2.2.2 Валидация на тарифа
    - SUB-1.2.2.3 feeForPeriod и roundToCents
  - TASK-1.2.3 FeeReport и грешки
    - SUB-1.2.3.1 FeeReport.ts
    - SUB-1.2.3.2 errors.ts

Частично засегнат (не се затваря тук): TASK-1.5.1 `test/domain.test.ts` —
създава се файлът с кейсовете на блупринта; STORY-1.5 го довършва.

## Capabilities

### New Capabilities

- `tiered-fee-calculation`: как от AUM, тарифа с нива и период се получава
  такса — marginal облагане по нива, валидност на тарифа, минимална годишна
  такса, пропорция по дни и закръгляне до цент.
- `billing-period`: какво е валиден период за таксуване (ISO дати, ред на
  границите) и как се броят дните в него.
- `fee-report`: структурата на резултата от изчислението — редове по сметка и
  обща сума — и правилото за сумиране.
- `domain-errors`: общият вид на грешките, които domain слоят вдига, и по какво
  горните слоеве ги различават.

### Modified Capabilities

(няма)

## Non-goals

- Никакви портове, use case, адаптери или bootstrap — STORY-1.3 … 1.8.
- Без `architecture.test.ts` — STORY-1.5. Критерият „`src/domain/` не
  импортира нищо извън `domain/`“ се спазва по конвенция и се проверява на
  ревю; автоматичната проверка идва със STORY-1.5.
- Без тарифа `premium` и без примерни данни (`data/*.json`) — STORY-1.6.
  Тестовете ползват тарифа `standard`, изведена от числата на блупринта.
- Без валути, без Decimal/BigInt аритметика — числата са JS `number`, а
  точността се управлява само чрез закръгляне до цент на изхода.
- Без валидация на `Account` (отрицателен AUM и пр.) — не е в backlog-а.

## Impact

- Нови файлове: `src/domain/Account.ts`, `src/domain/FeeSchedule.ts`,
  `src/domain/BillingPeriod.ts`, `src/domain/tieredFee.ts`,
  `src/domain/FeeReport.ts`, `src/domain/errors.ts`, `test/domain.test.ts`.
- Няма промени по `package.json`, `tsconfig.json`, зависимости.
- Всички следващи stories импортират тези типове и функции; формата им
  (сигнатури, имена на грешки) става договор за портовете и use case-а.
