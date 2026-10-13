---
id: SUB-1.7.1.3
type: subtask
title: "Превод на грешки"
status: done
parent: TASK-1.7.1
---

# SUB-1.7.1.3 Превод на грешки

`InvalidBillingPeriod` → 400; `*NotFound` → 404; друго → 500; тяло `{ error, message }`.

## Готово когато

- Кодът е написан и коментиран.
- `npm run typecheck` и `npm test` минават.
