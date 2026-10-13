---
id: STORY-1.2
type: story
title: "Domain: tiered такси"
status: done
parent: EPIC-1
---

# STORY-1.2 Domain: tiered такси

Като обучаващ се искам чиста domain логика без I/O, за да видя ядрото на хексагона.

## Критерии за приемане

- `src/domain/` не импортира нищо извън `domain/`.
- Примерите от блупринта дават 21 250 / 1 500 / 45 000 годишно и 5 239.73 за 90 дни.

## Таскове

- [TASK-1.2.1 Типове Account, FeeSchedule, BillingPeriod](TASK-1.2.1-types/TASK-1.2.1.md)
- [TASK-1.2.2 tieredFee.ts](TASK-1.2.2-tiered-fee/TASK-1.2.2.md)
- [TASK-1.2.3 FeeReport и грешки](TASK-1.2.3-report-errors/TASK-1.2.3.md)
