# Spec Delta

## Purpose

Определя HTTP входа към use case-а „изчисли таксите на household“: един
маршрут, формат на заявката и отговора и превода на грешки към HTTP статуси,
така че протоколът остава изцяло в адаптера, а use case-ът не знае за него.

## ADDED Requirements

### Requirement: HTTP адаптерът зависи само от inbound порта
HTTP адаптерът SHALL се конструира от стойност, която изпълнява
`CalculateHouseholdFees`, и SHALL не изисква конкретния сервиз, репозитории
или други outbound портове. Конструирането SHALL не отваря порт — слушането
е решение на извикващия.

#### Scenario: Fake use case
- **GIVEN** fake use case `{ execute }`, който връща предварително построен отчет
- **WHEN** адаптерът бъде конструиран с него и вдигнат на свободен порт
- **THEN** валидна заявка получава отчета на fake-а, без репозитории или сервиз в картинката

#### Scenario: Конструирането не слуша
- **GIVEN** конструиран, но не стартиран адаптер
- **WHEN** се провери дали слуша
- **THEN** не слуша, докато извикващият не го стартира изрично

### Requirement: Единствен маршрут POST /households/:id/fees
Адаптерът SHALL приема `POST /households/<householdId>/fees`, където
`<householdId>` е непразен сегмент (URL-декодиран преди употреба), и SHALL
отговаря с `404` и тяло `{ "error": "NOT_FOUND", "message": … }` на всеки
друг път или метод, без да вика use case-а.

#### Scenario: Правилен маршрут
- **GIVEN** fake use case и валидно тяло
- **WHEN** `POST /households/hh-1/fees`
- **THEN** use case-ът е извикан веднъж с `householdId = "hh-1"`

#### Scenario: Друг метод
- **GIVEN** вдигнат адаптер
- **WHEN** `GET /households/hh-1/fees`
- **THEN** статус `404`, тяло `{ "error": "NOT_FOUND", … }`, use case-ът не е извикан

#### Scenario: Друг път
- **GIVEN** вдигнат адаптер
- **WHEN** `POST /households/hh-1` или `POST /fees` или `POST /households//fees`
- **THEN** статус `404` и `error = "NOT_FOUND"` за всеки от тях

#### Scenario: Кодиран идентификатор
- **GIVEN** fake use case
- **WHEN** `POST /households/hh%201/fees`
- **THEN** use case-ът получава `householdId = "hh 1"`

### Requirement: Тялото е JSON обект с низове from и to
Адаптерът SHALL чете тялото като UTF-8 JSON и SHALL подава `from` и `to`
непроменени на use case-а. Невалиден JSON, тяло, което не е обект, или
липсващи/не-низови `from`/`to` SHALL дават `400` с
`{ "error": "BAD_REQUEST", "message": … }`, без извикване на use case-а.
Адаптерът SHALL не валидира датите — това е работа на use case-а.

#### Scenario: Валидно тяло
- **GIVEN** fake use case
- **WHEN** тялото е `{"from":"2026-01-01","to":"2026-03-31"}`
- **THEN** use case-ът е извикан с `{ householdId: "hh-1", from: "2026-01-01", to: "2026-03-31" }`

#### Scenario: Невалиден JSON
- **GIVEN** вдигнат адаптер
- **WHEN** тялото е `{ not json`
- **THEN** статус `400`, `error = "BAD_REQUEST"`, use case-ът не е извикан

#### Scenario: Липсващо поле
- **GIVEN** вдигнат адаптер
- **WHEN** тялото е `{"from":"2026-01-01"}`
- **THEN** статус `400`, `error = "BAD_REQUEST"`, съобщението назовава `to`

#### Scenario: Поле с грешен тип
- **GIVEN** вдигнат адаптер
- **WHEN** тялото е `{"from":"2026-01-01","to":20260331}` или `["2026-01-01","2026-03-31"]`
- **THEN** статус `400` и `error = "BAD_REQUEST"`

#### Scenario: Датите не се валидират в адаптера
- **GIVEN** fake use case, който записва командата и връща отчет
- **WHEN** тялото е `{"from":"not-a-date","to":"2026-03-31"}`
- **THEN** use case-ът е извикан с `from = "not-a-date"` (адаптерът е пропуснал низа непроменен)

### Requirement: Успехът е 200 с отчета като JSON
При успешно изпълнение адаптерът SHALL отговаря `200`, `Content-Type:
application/json; charset=utf-8`, и тяло — JSON сериализацията на отчета:
`{ householdId, period: { from, to }, lines: [{ accountId, accountName, aum,
feeScheduleId, fee }], total }`, с числата като JSON числа (без форматиране).

#### Scenario: Отчет за hh-1
- **GIVEN** fake use case, който връща отчета на `hh-1` за Q1 2026 (три реда, `total = 14239.73`)
- **WHEN** `POST /households/hh-1/fees` с валидно тяло
- **THEN** статус `200`, `Content-Type` започва с `application/json`, и парснатото тяло е deepEqual на отчета, с `total === 14239.73`

### Requirement: Domain грешките се превеждат в статуси само в адаптера
Адаптерът SHALL превежда отхвърляне от use case-а така: `InvalidBillingPeriod`
→ `400`; `HouseholdNotFound` и `FeeScheduleNotFound` → `404`; всяка друга
грешка → `500`. Тялото SHALL е `{ "error": <code>, "message": <text> }`, където
за domain грешка `error` е нейният `code` и `message` — нейното съобщение, а за
`500` `error` е `"INTERNAL_ERROR"` и `message` е общ текст без детайли от грешката.

#### Scenario: Невалиден период
- **GIVEN** fake use case, който отхвърля с `InvalidBillingPeriod("from must be YYYY-MM-DD, got \"x\"")`
- **WHEN** валидна по форма заявка
- **THEN** статус `400`, тяло `{ "error": "INVALID_BILLING_PERIOD", "message": "from must be YYYY-MM-DD, got \"x\"" }`

#### Scenario: Липсващ household
- **GIVEN** fake use case, който отхвърля с `HouseholdNotFound("hh-404")`
- **WHEN** `POST /households/hh-404/fees`
- **THEN** статус `404`, тяло `{ "error": "HOUSEHOLD_NOT_FOUND", "message": "Household not found: hh-404" }`

#### Scenario: Липсваща тарифа
- **GIVEN** fake use case, който отхвърля с `FeeScheduleNotFound("vip")`
- **WHEN** валидна заявка
- **THEN** статус `404` и `error = "FEE_SCHEDULE_NOT_FOUND"`

#### Scenario: Неочаквана грешка
- **GIVEN** fake use case, който отхвърля с `new Error("disk on fire")`
- **WHEN** валидна заявка
- **THEN** статус `500`, тяло `{ "error": "INTERNAL_ERROR", "message": … }`, и `message` не съдържа `disk on fire`

#### Scenario: Друга domain грешка
- **GIVEN** fake use case, който отхвърля с `InvalidFeeSchedule("…")`
- **WHEN** валидна заявка
- **THEN** статус `500` и `error = "INTERNAL_ERROR"` (грешка в данните, не в заявката)

### Requirement: Всеки отговор е JSON
Всеки отговор на адаптера, включително грешките, SHALL носи `Content-Type:
application/json; charset=utf-8` и JSON тяло, за да може клиентът да разчита
на един формат.

#### Scenario: 404 е JSON
- **GIVEN** вдигнат адаптер
- **WHEN** `GET /nope`
- **THEN** `Content-Type` започва с `application/json` и тялото се парсва като обект с `error` и `message`
