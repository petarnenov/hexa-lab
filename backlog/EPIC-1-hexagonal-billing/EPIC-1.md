---
id: EPIC-1
type: epic
title: "Хексагонален мини billing"
status: todo
---

# EPIC-1 Хексагонален мини billing

Работещ TypeScript проект, който показва Ports & Adapters върху tiered такси по AUM. Един use case, два driving адаптера (CLI, HTTP), сменяем driven адаптер (memory/json).

## Критерии за приемане

- `npm run typecheck` и `npm test` минават.
- Един и същ use case дава `total: 14239.73` за `hh-1` (Q1 2026) през CLI и HTTP, с memory и json.
- `architecture.test.ts` пази правилото за зависимостите.

## Истории

- [STORY-1.1 Скелет на проекта](STORY-1.1-skeleton/STORY-1.1.md)
- [STORY-1.2 Domain: tiered такси](STORY-1.2-domain/STORY-1.2.md)
- [STORY-1.3 Портове in/out](STORY-1.3-ports/STORY-1.3.md)
- [STORY-1.4 Use case: изчисли таксите на household](STORY-1.4-use-case/STORY-1.4.md)
- [STORY-1.5 Тестове](STORY-1.5-tests/STORY-1.5.md)
- [STORY-1.6 Out адаптери](STORY-1.6-out-adapters/STORY-1.6.md)
- [STORY-1.7 In адаптери: HTTP и CLI](STORY-1.7-in-adapters/STORY-1.7.md)
- [STORY-1.8 Bootstrap: composition root](STORY-1.8-bootstrap/STORY-1.8.md)
- [STORY-1.9 README и демо](STORY-1.9-readme-demo/STORY-1.9.md)
