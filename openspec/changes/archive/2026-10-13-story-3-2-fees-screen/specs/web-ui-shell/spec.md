# Spec Delta

## MODIFIED Requirements

### Requirement: App shell показва заглавие и празно съдържание
Страницата SHALL има header със заглавие „hexa-lab“ (heading от ниво 1) и
подзаглавие „Household fees“, и `main` област, която съдържа формата за
household и период (вж. `web-ui-fee-form`) и под нея отчета
(вж. `web-ui-fee-report`).

#### Scenario: Smoke рендер
- **WHEN** `App` се рендерира
- **THEN** се намира heading с текст „hexa-lab“ и текст „Household fees“

#### Scenario: Формата и отчетът са в main
- **WHEN** `App` се рендерира
- **THEN** в `main` има форма с бутон „Calculate“ и под нея областта на отчета в състояние idle
