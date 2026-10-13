---
id: STORY-3.2
type: story
title: "Екран „Такси на household“"
status: todo
parent: EPIC-3
---

# STORY-3.2 Екран „Такси на household“

Като обучаващ се искам форма (household, от, до) и отчет (редове + total),
за да видя същите числа като от CLI и curl, но в браузър.

## Критерии за приемане

- Формата е предварително попълнена с `hh-1`, `2026-01-01`, `2026-03-31`.
- Submit вика `POST /households/:id/fees` през React Query `useMutation`.
- Отчетът показва ред на акаунт (име, AUM, тарифа, такса) и `total: 14 239.73`.
- Състояния: idle, loading (бутонът disabled + spinner текст), error (код + съобщение), success.
- `hh-404` показва `HOUSEHOLD_NOT_FOUND` и съобщението; невалиден период - `INVALID_BILLING_PERIOD`.
- Всичко е покрито с Vitest + Testing Library, с mock-нат `fetch`.

## Таскове

- [TASK-3.2.1 API клиент](TASK-3.2.1-api-client/TASK-3.2.1.md)
- [TASK-3.2.2 Форма](TASK-3.2.2-form/TASK-3.2.2.md)
- [TASK-3.2.3 Отчет](TASK-3.2.3-report/TASK-3.2.3.md)
- [TASK-3.2.4 Тестове](TASK-3.2.4-tests/TASK-3.2.4.md)
