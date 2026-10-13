---
id: SUB-3.1.1.1
type: subtask
title: "package.json и скриптове"
status: done
parent: TASK-3.1.1
---

# SUB-3.1.1.1 package.json и скриптове

`ui/package.json`: `dev`, `build`, `preview`, `test` (vitest run), `typecheck`
(tsc --noEmit). Зависимости: `react`, `react-dom`, `@tanstack/react-query`.
Dev: `vite`, `@vitejs/plugin-react`, `typescript`, `vitest`, `jsdom`,
`@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`,
`@types/react`, `@types/react-dom`. В кореновия `package.json` се добавят
`ui` (`npm --prefix ui run dev`) и `ui:test` (`npm --prefix ui test`) - без нови
зависимости в корена.

## Готово когато

- `cd ui && npm install && npm run dev` стартира.
- Кореновият `npm test` и `npm run typecheck` са непроменени и минават.
