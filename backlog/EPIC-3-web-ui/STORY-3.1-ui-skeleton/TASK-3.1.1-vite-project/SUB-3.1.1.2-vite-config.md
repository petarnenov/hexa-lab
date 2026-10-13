---
id: SUB-3.1.1.2
type: subtask
title: "vite.config.ts с proxy"
status: todo
parent: TASK-3.1.1
---

# SUB-3.1.1.2 vite.config.ts с proxy

`server.proxy`: `/households` → `http://localhost:3000`. Така браузърът вика
същия origin, няма CORS и HTTP адаптерът остава както е. Портът на backend-а
се чете от `process.env.PORT || 3000`, за да съвпада с `npm run http`.
Вкл. `test` секцията на Vitest (environment `jsdom`, `setupFiles`).

## Готово когато

- При работещ `npm run http`, `fetch("/households/hh-1/fees", {method: "POST", ...})`
  от dev сървъра връща отчета.
