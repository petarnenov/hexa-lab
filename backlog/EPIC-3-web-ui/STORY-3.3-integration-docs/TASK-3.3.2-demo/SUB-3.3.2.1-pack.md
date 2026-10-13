---
id: SUB-3.3.2.1
type: subtask
title: "pack включва ui/"
status: done
parent: TASK-3.3.2
---

# SUB-3.3.2.1 pack включва ui/

`scripts/pack-demo.ts` добавя `ui/` към `hexa.tar.gz`, като пропуска
`ui/node_modules` и `ui/dist`. Инструкцията за другата страна става
`npm install && npm test && (cd ui && npm install && npm test)`.

## Готово когато

- `npm run pack && tar -tzf hexa.tar.gz | grep ui/` показва файловете без node_modules.
