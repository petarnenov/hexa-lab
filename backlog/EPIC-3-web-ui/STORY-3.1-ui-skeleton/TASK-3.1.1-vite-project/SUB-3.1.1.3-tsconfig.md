---
id: SUB-3.1.1.3
type: subtask
title: "tsconfig.json и .gitignore"
status: todo
parent: TASK-3.1.1
---

# SUB-3.1.1.3 tsconfig.json и .gitignore

`ui/tsconfig.json`: `strict`, `jsx: react-jsx`, `moduleResolution: bundler`,
`noEmit`, `types: ["vitest/globals", "@testing-library/jest-dom"]`. Кореновият
`tsconfig.json` не включва `ui/`. В `.gitignore`: `ui/node_modules/`, `ui/dist/`.

## Готово когато

- `cd ui && npm run typecheck` минава.
- Кореновият `npm run typecheck` не вижда `ui/`.
