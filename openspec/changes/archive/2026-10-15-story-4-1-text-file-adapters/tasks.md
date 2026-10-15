# Tasks

## 1. TASK-4.1.1 TextFile репозиторита

- [x] 1.1 Сложи `status: in-progress` на STORY-4.1.
- [x] 1.2 (SUB-4.1.1.3) `data/accounts.txt` и `data/fee-schedules.txt` по design.md D1.
- [x] 1.3 (SUB-4.1.1.1) Тестове в `describe("text-file-repositories")` (contract, ред, коментари, четене при всяка заявка, лоши редове), после `TextFileAccountRepository`.
- [x] 1.4 (SUB-4.1.1.2) Тестове за лоши нива/числа, после `TextFileFeeScheduleRepository`.
- [x] 1.5 End-to-end: същият отчет над memory и над txt.
- [x] 1.6 `npm run typecheck && npm test` минават.

## 2. TASK-4.1.2 TextFileFeeReportPublisher

- [x] 2.1 (SUB-4.1.2.1) Тестове: формат на блока, създаване на файла, добавяне, грешка с пътя, use case-ът публикува върнатия отчет.
- [x] 2.2 `TextFileFeeReportPublisher` по D2.
- [x] 2.3 `npm run typecheck && npm test` минават.

## 3. TASK-4.1.3 Връзване в bootstrap и README

- [x] 3.1 (SUB-4.1.3.1) Тестове: `STORAGE=txt`, `PUBLISHER=txt`/`console`/`''`/непознат, `reportFileFrom`, seed срещу `data/*.txt`, CLI child process със `STORAGE=txt`; `childEnv` маха `PUBLISHER` и `REPORT_FILE`.
- [x] 3.2 (SUB-4.1.3.1) `compose.ts` по D3/D4; `.gitignore` и `pack-demo.ts` изключват `data/fee-reports.txt`.
- [x] 3.3 (SUB-4.1.3.2) README: диаграма, таблица с променливите, секция „Plain text files“.
- [x] 3.4 `npm run typecheck && npm test` минават; ръчно `STORAGE=txt PUBLISHER=txt npm run cli -- hh-1 2026-01-01 2026-03-31` → `14239.73` и блок в `data/fee-reports.txt`.

## Workflow follow-up

- `/opsx:archive story-4-1-text-file-adapters` — създава `openspec/specs/{text-file-repositories,text-file-report-publisher}/`, мърджва `composition-root` и сменя status на STORY-4.1, TASK-4.1.x, SUB-4.1.x.y (и EPIC-4) на `done`.
- `/commit`, после `/clear`.
