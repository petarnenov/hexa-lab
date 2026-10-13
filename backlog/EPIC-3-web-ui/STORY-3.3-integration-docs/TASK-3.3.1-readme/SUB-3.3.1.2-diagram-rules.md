---
id: SUB-3.3.1.2
type: subtask
title: "Диаграма и правила"
status: todo
parent: TASK-3.3.1
---

# SUB-3.3.1.2 Диаграма и правила

ASCII диаграмата в README получава `browser (ui/)` → `createHttpServer`
отвън, както `curl`. В CLAUDE.md и `openspec/config.yaml` правилото „без
runtime зависимости“ се уточнява: важи за корена/`src/`; `ui/` е отделен
пакет. Структурата в CLAUDE.md споменава `ui/`.

## Готово когато

- Документите описват реалната структура; `npm test` в корена минава.
