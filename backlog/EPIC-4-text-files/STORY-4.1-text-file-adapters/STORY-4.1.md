---
id: STORY-4.1
type: story
title: "TextFile адаптери за трите outbound порта"
status: done
parent: EPIC-4
---

# STORY-4.1 TextFile адаптери за трите outbound порта

Като обучаващ се искам `AccountRepository`, `FeeScheduleRepository` и
`FeeReportPublisher` да имат и txt адаптер, за да видя, че трета технология
се добавя само в `adapters/out/` и `bootstrap/`.

## Критерии за приемане

- Contract тестът на репозиториите минава и за txt двойката.
- `STORAGE=txt npm run cli -- hh-1 2026-01-01 2026-03-31 --json` дава байт по байт същия stdout като memory.
- `PUBLISHER=txt` добавя блок с отчета към `REPORT_FILE` (по подразбиране `data/fee-reports.txt`, git-ignored).
- Лош ред в txt файл дава грешка с `<път>:<ред>`.

## Таскове

- [TASK-4.1.1 TextFile репозиторита](TASK-4.1.1-repositories/TASK-4.1.1.md)
- [TASK-4.1.2 TextFileFeeReportPublisher](TASK-4.1.2-publisher/TASK-4.1.2.md)
- [TASK-4.1.3 Връзване в bootstrap и README](TASK-4.1.3-wiring/TASK-4.1.3.md)
