---
id: SUB-3.2.4.2
type: subtask
title: "Грешки от сървъра"
status: done
parent: TASK-3.2.4
---

# SUB-3.2.4.2 Грешки от сървъра

404 `HOUSEHOLD_NOT_FOUND`, 400 `INVALID_BILLING_PERIOD`, мрежова грешка
(`fetch` reject-ва). Всяка показва alert с кода; бутонът отново е активен;
нов submit чисти предишната грешка.

## Готово когато

- Трите теста минават; `cd ui && npm test && npm run typecheck` зелено.
