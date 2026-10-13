---
id: SUB-3.1.2.2
type: subtask
title: "App shell"
status: todo
parent: TASK-3.1.2
---

# SUB-3.1.2.2 App shell

`ui/src/App.tsx`: header с „hexa-lab“ и подзаглавие „Household fees“, `main`
с max-width ~720px, центриран, 16px gutter на телефон. `main.tsx` рендерира
`App` в `QueryClientProvider` с един `QueryClient`.

## Готово когато

- `npm run dev` показва shell-а в тъмна тема; няма хоризонтален скрол при 375px.
