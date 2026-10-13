# Spec Delta

## MODIFIED Requirements

### Requirement: Скрипт test изпълнява UI тестовете в DOM среда
`cd ui && npm test` SHALL изпълни еднократно (без watch) всеки файл
`ui/src/**/*.test.ts` и `ui/src/**/*.test.tsx` в симулирана DOM среда с
матчъри за DOM (`toBeInTheDocument` и т.н.) и SHALL завършва с ненулев код
при неуспешен тест.

#### Scenario: Всички тестове минават
- **WHEN** всички `*.test.ts` и `*.test.tsx` файлове минават
- **THEN** `cd ui && npm test` завършва с код 0 и отчита броя тестове

#### Scenario: Неуспешен тест
- **WHEN** тест assert-ва елемент, който не е рендериран
- **THEN** `cd ui && npm test` завършва с ненулев код и показва името на теста

#### Scenario: Нов тестов файл се открива автоматично
- **WHEN** разработчик добави `ui/src/FeeForm.test.tsx`
- **THEN** `cd ui && npm test` го изпълнява без промяна на конфигурация

#### Scenario: Тест без JSX се открива автоматично
- **WHEN** разработчик добави `ui/src/api/calculateFees.test.ts`
- **THEN** `cd ui && npm test` го изпълнява без промяна на конфигурация
