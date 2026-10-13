# Design

## Context

`src/` е празен; toolchain-ът от STORY-1.1 дава strict ESM, `.ts` import-и и
`node:test` (вж. proposal.md — Why). Domain слоят е най-вътрешният в хексагона
и SHALL импортира само `node:`-независим собствен код от `src/domain/` — нито
`node:fs`, нито `node:crypto`, нито application. Всичко е синхронно и чисто:
едни и същи входове → едни и същи изходи, без дата „сега“ (периодът идва отвън).

Числата от блупринта, от които се извежда тарифата `standard`:

| AUM | Годишна такса | Извод |
|---|---|---|
| 150 000 | 1 500 | 100 bps в първото ниво |
| 2 500 000 | 21 250 | 10 000 + 1 500 000 × 75 bps |
| 6 000 000 | 45 000 | 10 000 + 30 000 + 1 000 000 × 50 bps |
| 150 000, 365 дни | 2 500 | минимална годишна такса 2 500 |
| 2 500 000, 90 дни | 5 239.73 | 21 250 × 90 / 365 |

→ `standard = { tiers: [1M @ 100, 5M @ 75, null @ 50], minimumAnnualFee: 2500 }`.

## Goals / Non-Goals

**Goals:**
- Шест малки файла с по една отговорност, четими от обучаващ се за минути.
- Сигнатури, които STORY-1.3/1.4 ползват без промяна.
- Детерминистично закръгляне, така че CLI и HTTP да дават идентични числа.

**Non-Goals:**
- Barrel `src/domain/index.ts` — всеки консуматор импортира конкретния файл;
  така `architecture.test.ts` (STORY-1.5) вижда реалните зависимости.
- Branded типове за ID-та (`AccountId` и пр.) — добавят шум без полза тук.
- Обобщена `Money`/`Decimal` абстракция.

## Decisions

### D1. Файлова структура и сигнатури

```
src/domain/
  Account.ts        type Account = { id; householdId; name; aum; feeScheduleId }
  FeeSchedule.ts    type FeeTier = { upTo: number | null; annualRateBps: number }
                    type FeeSchedule = { id; name; tiers: FeeTier[]; minimumAnnualFee: number }
  BillingPeriod.ts  type BillingPeriod = { readonly from: IsoDate; readonly to: IsoDate }
                    createBillingPeriod(from: string, to: string): BillingPeriod
                    daysInPeriod(period: BillingPeriod): number
  tieredFee.ts      validateFeeSchedule(schedule): void
                    annualTieredFee(aum, schedule): number
                    feeForPeriod(aum, schedule, period): number
                    roundToCents(value): number
  FeeReport.ts      type FeeLine = { accountId; accountName; aum; feeScheduleId; fee }
                    type FeeReport = { householdId; period; lines: FeeLine[]; total }
                    buildFeeReport(householdId, period, lines): FeeReport
  errors.ts         DomainError (abstract, code) + 4 конкретни класа
```

- Типовете са `type` (не `interface`/`class`) — данните идват от JSON и памет
  и нямат поведение; поведението е в самостоятелни функции. Това е и най-
  директната илюстрация, че domain-ът не знае откъде идват данните.
- `IsoDate` е `string` alias (не brand) с коментар; валидацията е в
  конструктора, не в типа.
- Функциите са чисти и изнесени поотделно, не като методи — по-лесни за
  тест и за импорт от application без обвързване.

### D2. Пари като `number`, точност чрез `roundToCents`

- JS `number` с `roundToCents(v) = Math.round((v + Number.EPSILON) * 100) / 100`.
  `Number.EPSILON` компенсира класическия случай `1.005 → 1.00`.
- Закръгля се **само** на изхода: `feeForPeriod` и `buildFeeReport`.
  `annualTieredFee` връща сурова стойност, за да не се натрупва грешка от
  междинно закръгляне (21 250 × 90 / 365 се смята върху точните 21 250).
- Алтернатива: цели центове / `BigInt`. Отхвърлена — усложнява всеки тест и
  пример (`525000n`), а учебната цел е архитектурата, не финансовата
  аритметика. Рискът е записан в „Risks“.

### D3. Marginal изчисление в `annualTieredFee`

Обхождане на нивата с „долна граница“ `lower = 0`; за всяко ниво облагаемата
част е `min(aum, upTo ?? ∞) - lower`, ако е положителна; `lower = upTo`.
Ставка `annualRateBps / 10_000`. Спира се, когато `aum <= upTo`. Извиква
`validateFeeSchedule` в началото — така всяка невалидна тарифа гърми при
първото изчисление, не тихо дава грешно число. AUM точно на граница облага
нивото с границата включително (`≤ upTo`).

### D4. Валидация на тарифа като отделна функция

`validateFeeSchedule` хвърля `InvalidFeeSchedule` при: празни нива; `upTo ===
null` не на последна позиция; `upTo` не строго възходящ (`<=` предходния).
Отделна е (не inline в `annualTieredFee`), защото STORY-1.6 JSON репозиторият
и STORY-1.4 use case-ът може да искат да валидират при зареждане, преди да има
AUM за смятане.

### D5. `BillingPeriod` само с UTC и регулярен израз

- Формат: `/^\d{4}-\d{2}-\d{2}$/`, после `Date.UTC(y, m-1, d)` и обратна
  проверка `getUTCFullYear/Month/Date === y/m/d` — отхвърля `2026-02-30`,
  който `new Date("2026-02-30")` би „нормализирал“ или върнал `Invalid Date`
  в зависимост от средата.
- `daysInPeriod = (utc(to) - utc(from)) / 86_400_000 + 1` — включително;
  UTC елиминира DST (локално `new Date("2026-03-29")` в Европа би дало ден
  от 23 часа и дробни дни).
- Годината в пропорцията е фиксирана 365 (spec), дори за високосен период —
  простота пред актюерска точност; STORY-2.x може да го направи параметър.
- Алтернатива `Temporal` — още не е стабилна в Node 24 без флаг; отхвърлена.

### D6. Грешки: класова йерархия с `code`

```ts
export abstract class DomainError extends Error {
  abstract readonly code: string;
  constructor(message: string) { super(message); this.name = new.target.name; }
}
export class InvalidBillingPeriod extends DomainError { code = "INVALID_BILLING_PERIOD" ... }
export class InvalidFeeSchedule  extends DomainError { code = "INVALID_FEE_SCHEDULE" ... }
export class HouseholdNotFound   extends DomainError { code = "HOUSEHOLD_NOT_FOUND"; householdId }
export class FeeScheduleNotFound extends DomainError { code = "FEE_SCHEDULE_NOT_FOUND"; feeScheduleId }
```
- `name = new.target.name` дава четим stack и работи при наследяване без
  да се повтаря във всеки клас.
- `code` вместо `instanceof` като основен дискриминатор за адаптерите —
  стабилен низ, лесен за `switch` и за JSON тяло на HTTP грешка (STORY-1.7).
- `HouseholdNotFound`/`FeeScheduleNotFound` живеят в domain, макар да се
  вдигат от use case-а: липсата на household е бизнес факт, не техническа
  грешка на репозиторий. Алтернатива — в `application/errors.ts`; отхвърлена,
  за да има един речник от грешки.

### D7. `buildFeeReport` сумира, не смята

Приема готови `FeeLine[]` с вече закръглени `fee`; `total =
roundToCents(Σ fee)`. Не вика `feeForPeriod` сам — така use case-ът (STORY-1.4)
решава как да получи редовете (за всяка сметка — нейната тарифа), а отчетът е
чиста структура. Редът на редовете се запазва както е подаден.

### D8. Тестове: `test/domain.test.ts` сега, STORY-1.5 допълва

Проектното правило е тест преди код, затова тестът се пише в този change с
`describe` блокове по capability (`tiered-fee-calculation`, `billing-period`,
`fee-report`, `domain-errors`), по един `test` на spec scenario. STORY-1.5
(TASK-1.5.1) ще добави каквото липсва, без да преструктурира файла.

## Risks / Trade-offs

- [Float аритметика при големи AUM/много редове] → закръгляне само на изхода
  с `Number.EPSILON`; тест за `0.1 + 0.2` и `1.005`; при нужда STORY-2.x
  сменя представянето само в `tieredFee.ts`/`FeeReport.ts`.
- [Фиксирани 365 дни дават >100 % годишна такса за 366-дневен период] →
  документирано в spec и тест; осъзнат учебен компромис.
- [Няма защита срещу отрицателен AUM или отрицателни bps] → извън backlog-а;
  `annualTieredFee` връща 0 за AUM ≤ 0 чрез клаузата „само положителна част“,
  което е безопасно по подразбиране.
- [Без `architecture.test.ts` правилото „само domain/“ не е enforce-нато] →
  code review в този change; STORY-1.5 го автоматизира.
