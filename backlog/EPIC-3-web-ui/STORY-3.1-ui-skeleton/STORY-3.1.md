---
id: STORY-3.1
type: story
title: "Скелет на UI"
status: todo
parent: EPIC-3
---

# STORY-3.1 Скелет на UI

Като обучаващ се искам `ui/` с Vite + React + TypeScript, Vitest и тъмна тема,
за да имам празен, но работещ екран, върху който да сложа формата и отчета.

## Критерии за приемане

- `cd ui && npm run dev` отваря страница с header „hexa-lab“ в тъмна тема.
- `cd ui && npm test` пуска Vitest и минава поне един smoke тест.
- `cd ui && npm run typecheck` минава (strict).
- От корена `npm run ui` стартира dev сървъра; `/households/*` се proxy-ва към `:3000`.

## Таскове

- [TASK-3.1.1 Vite проект](TASK-3.1.1-vite-project/TASK-3.1.1.md)
- [TASK-3.1.2 Тъмна тема и App shell](TASK-3.1.2-dark-theme/TASK-3.1.2.md)
- [TASK-3.1.3 Vitest](TASK-3.1.3-vitest/TASK-3.1.3.md)
