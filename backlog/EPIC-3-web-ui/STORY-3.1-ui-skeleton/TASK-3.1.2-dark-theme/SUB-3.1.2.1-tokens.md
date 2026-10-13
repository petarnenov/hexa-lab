---
id: SUB-3.1.2.1
type: subtask
title: "Design tokens"
status: todo
parent: TASK-3.1.2
---

# SUB-3.1.2.1 Design tokens

`ui/src/styles.css` с `:root` променливи: фон (`--bg`, `--surface`), текст
(`--text`, `--muted`), акцент (`--accent`), граница (`--border`), грешка
(`--danger`), радиус, spacing скала, system font stack + `tabular-nums` за
числата. Само тъмна тема; `color-scheme: dark`, за да са тъмни и native
input-ите (date picker). Контраст текст/фон ≥ 4.5:1.

## Готово когато

- Всички цветове в UI-я идват от променливите; няма hardcoded hex извън `:root`.
