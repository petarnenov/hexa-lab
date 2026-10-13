---
id: SUB-3.1.3.1
type: subtask
title: "Setup файл"
status: done
parent: TASK-3.1.3
---

# SUB-3.1.3.1 Setup файл

`ui/src/test/setup.ts`: импорт на `@testing-library/jest-dom/vitest`, `cleanup`
след всеки тест. Помощник `renderWithQuery(ui)`, който увива в нов
`QueryClient` с `retry: false`, за да не чакат тестовете при грешка.

## Готово когато

- `cd ui && npm test` открива и пуска `src/**/*.test.tsx`.
