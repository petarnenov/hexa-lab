---
id: STORY-1.7
type: story
title: "In адаптери: HTTP и CLI"
status: todo
parent: EPIC-1
---

# STORY-1.7 In адаптери: HTTP и CLI

Като обучаващ се искам два driving адаптера към един и същ inbound порт, за да видя, че use case-ът не зависи от протокола.

## Критерии за приемане

- Адаптерите получават `CalculateHouseholdFees`, не конкретния сервиз.
- Грешките се превеждат в HTTP статуси и exit кодове само в адаптерите.

## Таскове

- [TASK-1.7.1 HTTP адаптер](TASK-1.7.1-http/TASK-1.7.1.md)
- [TASK-1.7.2 CLI адаптер](TASK-1.7.2-cli/TASK-1.7.2.md)
