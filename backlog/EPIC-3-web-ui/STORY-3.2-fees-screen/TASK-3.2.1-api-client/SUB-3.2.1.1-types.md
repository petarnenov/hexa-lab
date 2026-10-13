---
id: SUB-3.2.1.1
type: subtask
title: "Типове FeeReport"
status: todo
parent: TASK-3.2.1
---

# SUB-3.2.1.1 Типове FeeReport

`ui/src/api/types.ts`: `FeeLine`, `FeeReport`, `FeeRequest` - копие на формата
от `src/domain/FeeReport.ts`, не импорт. Коментар защо: UI-ят е отделен
клиент и познава само JSON договора на HTTP адаптера, не домейна.

## Готово когато

- Типовете съвпадат поле по поле с JSON-а, който `curl` връща в README.
