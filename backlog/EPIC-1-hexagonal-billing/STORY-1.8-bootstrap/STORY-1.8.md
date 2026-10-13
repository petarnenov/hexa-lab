---
id: STORY-1.8
type: story
title: "Bootstrap: composition root"
status: todo
parent: EPIC-1
---

# STORY-1.8 Bootstrap: composition root

Като обучаващ се искам едно място, където адаптерите се връзват към портовете, за да сменям storage без промени другаде.

## Критерии за приемане

- Само `src/bootstrap/` импортира конкретни адаптери.
- `STORAGE=memory|json` сменя репоситоритата; друга стойност дава ясна грешка.

## Таскове

- [TASK-1.8.1 compose.ts](TASK-1.8.1-compose/TASK-1.8.1.md)
- [TASK-1.8.2 Entry points](TASK-1.8.2-entry-points/TASK-1.8.2.md)
