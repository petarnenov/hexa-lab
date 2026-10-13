---
id: SUB-3.2.2.2
type: subtask
title: "Submit през useMutation"
status: done
parent: TASK-3.2.2
---

# SUB-3.2.2.2 Submit през useMutation

`useCalculateFees()` - hook върху `useMutation({ mutationFn: calculateFees })`.
`App` държи mutation-а и подава `onSubmit`, `isPending` на формата и
`data`/`error` на отчета. Бутонът е disabled докато `isPending`; Enter
в поле също submit-ва.

## Готово когато

- Тест: submit вика `calculateFees` с точно стойностите от полетата.
