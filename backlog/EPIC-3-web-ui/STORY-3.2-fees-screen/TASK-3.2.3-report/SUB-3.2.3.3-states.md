---
id: SUB-3.2.3.3
type: subtask
title: "Състояния idle/loading/error"
status: todo
parent: TASK-3.2.3
---

# SUB-3.2.3.3 Състояния idle/loading/error

- idle: тих текст „Pick a household and a period.“
- loading: „Calculating…“ с `aria-busy`.
- error: панел с `--danger` рамка, `code` като badge, съобщението отдолу; `role="alert"`.
- success: таблицата.

## Готово когато

- Тест за всяко състояние; error панелът показва `HOUSEHOLD_NOT_FOUND` за `hh-404`.
