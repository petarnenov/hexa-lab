---
id: SUB-3.2.1.3
type: subtask
title: "ApiError"
status: todo
parent: TASK-3.2.1
---

# SUB-3.2.1.3 ApiError

`class ApiError extends Error { status; code }` - чете `{error, message}` от
тялото на HTTP адаптера. При тяло, което не е JSON (мрежова грешка, proxy
down), `code = "NETWORK_ERROR"` и четимо съобщение.

## Готово когато

- Тестове за 400, 404, 500 и non-JSON отговор.
