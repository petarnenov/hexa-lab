---
id: SUB-3.2.2.1
type: subtask
title: "Полета и defaults"
status: todo
parent: TASK-3.2.2
---

# SUB-3.2.2.1 Полета и defaults

`householdId` (text), `from` и `to` (`type="date"`), всяко с `<label>`.
Defaults: `hh-1`, `2026-01-01`, `2026-03-31`. Полетата на един ред на desktop,
едно под друго на телефон. Няма клиентска валидация на датите - това е
работа на use case-а; UI-ят само показва грешката му.

## Готово когато

- Тест: полетата са достъпни по label и имат default стойностите.
