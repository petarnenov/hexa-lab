---
id: SUB-3.2.4.1
type: subtask
title: "Успешен път"
status: done
parent: TASK-3.2.4
---

# SUB-3.2.4.1 Успешен път

`App.test.tsx`: рендер → submit с defaults → `fetch` е извикан с
`/households/hh-1/fees` и `{"from":"2026-01-01","to":"2026-03-31"}` → таблицата
показва трите реда и `14,239.73`. Fixture-ът е JSON-ът от README.

## Готово когато

- Тестът минава; `userEvent` вместо `fireEvent`.
