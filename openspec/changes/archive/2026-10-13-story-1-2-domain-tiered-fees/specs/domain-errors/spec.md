# Spec Delta

## Purpose

Определя общия вид на грешките, които domain слоят вдига, така че use case-ът и
driving адаптерите да ги разпознават по тип и код и да ги превеждат (HTTP
статус, exit code) без да разчитат на текста на съобщението.

## ADDED Requirements

### Requirement: Всички domain грешки споделят общ базов тип и код
Всяка domain грешка SHALL е `Error`, SHALL наследява общ базов тип
`DomainError` и SHALL носи стабилен машинно-четим `code`, различен за всеки вид
грешка. Съобщението SHALL е човешки четимо и SHALL съдържа стойността, която е
причинила грешката.

#### Scenario: Разпознаване по базов тип
- **GIVEN** вдигната `InvalidFeeSchedule`
- **WHEN** горен слой провери `instanceof DomainError` и `instanceof Error`
- **THEN** и двете проверки са верни

#### Scenario: Разпознаване по код
- **GIVEN** грешките `InvalidBillingPeriod`, `InvalidFeeSchedule`, `HouseholdNotFound`, `FeeScheduleNotFound`
- **WHEN** се сравнят техните `code`
- **THEN** четирите кода са различни и `name` на всяка грешка съвпада с името на вида ѝ

### Requirement: Грешките за липсващи данни са част от domain речника
Domain слоят SHALL дефинира `HouseholdNotFound` и `FeeScheduleNotFound`, носещи
търсения идентификатор, дори и да ги вдига едва use case-ът — така
application слоят не измисля собствени типове грешки.

#### Scenario: HouseholdNotFound носи идентификатора
- **WHEN** се създаде `HouseholdNotFound("hh-404")`
- **THEN** грешката има `householdId = "hh-404"` и съобщението съдържа `hh-404`

#### Scenario: FeeScheduleNotFound носи идентификатора
- **WHEN** се създаде `FeeScheduleNotFound("gold")`
- **THEN** грешката има `feeScheduleId = "gold"` и съобщението съдържа `gold`
