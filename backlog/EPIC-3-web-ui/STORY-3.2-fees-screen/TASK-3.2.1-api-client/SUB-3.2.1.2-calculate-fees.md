---
id: SUB-3.2.1.2
type: subtask
title: "calculateFees"
status: done
parent: TASK-3.2.1
---

# SUB-3.2.1.2 calculateFees

`calculateFees({householdId, from, to}): Promise<FeeReport>` - `fetch` с
`POST /households/${encodeURIComponent(id)}/fees`, JSON тяло `{from, to}`,
`content-type: application/json`. Не-2xx → хвърля `ApiError`.

## Готово когато

- Тест с mock-нат `fetch` проверява URL, метод, тяло и върнатия отчет.
