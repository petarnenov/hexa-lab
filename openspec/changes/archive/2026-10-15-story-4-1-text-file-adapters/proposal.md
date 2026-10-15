# Proposal

## Why

Зад outbound портовете стоят две технологии (memory и JSON). Трета —
обикновени `.txt` файлове, които човек редактира без да мисли за кавички и
скоби — показва още веднъж, че нова технология се добавя само в
`adapters/out/` и `bootstrap/`. Този път и третият порт,
`FeeReportPublisher`, получава втори адаптер: отчетите се пазят във файл,
не само се показват на stderr.

## What Changes

- Нови `TextFileAccountRepository` и `TextFileFeeScheduleRepository` в
  `src/adapters/out/`: един запис на ред, полета разделени с `|`, празни
  редове и `#` коментари се пропускат; файлът се чете при всяка заявка;
  лош ред дава обикновен `Error` с `<път>:<ред>`.
- Нови `data/accounts.txt` и `data/fee-schedules.txt` — същите данни като
  `data/*.json` и `seed.ts`.
- Нов `TextFileFeeReportPublisher`: добавя (`appendFile`) всеки отчет като
  блок от редове в текстов файл.
- `compose.ts`: `STORAGE=txt`; нова променлива `PUBLISHER=console|txt`
  (по подразбиране `console`) и `REPORT_FILE` (по подразбиране
  `<DATA_DIR>/fee-reports.txt`, git-ignored и извън `npm run pack`).
- Тестове: contract-ът на репозиториите и за txt двойката, формат/грешки,
  publisher-ът, bootstrap-ът и CLI child process със `STORAGE=txt`.
- README: диаграма, таблица с env променливи, секция „Plain text files“.

## Покрити backlog елементи

- STORY-4.1 TextFile адаптери за трите outbound порта
  - TASK-4.1.1 TextFile репозиторита
    - SUB-4.1.1.1 TextFileAccountRepository
    - SUB-4.1.1.2 TextFileFeeScheduleRepository
    - SUB-4.1.1.3 data/accounts.txt и data/fee-schedules.txt
  - TASK-4.1.2 TextFileFeeReportPublisher
    - SUB-4.1.2.1 Формат на блока
  - TASK-4.1.3 Връзване в bootstrap и README
    - SUB-4.1.3.1 compose.ts
    - SUB-4.1.3.2 README

## Capabilities

### New Capabilities

- `text-file-repositories`: формат на `data/*.txt`, четене при всяка заявка,
  грешки с `<път>:<ред>`, еднакъв отчет с memory.
- `text-file-report-publisher`: формат на блока, добавяне без презапис,
  грешка с пътя.

### Modified Capabilities

- `composition-root`: `STORAGE` приема и `txt`; нов `PUBLISHER`/`REPORT_FILE`.

## Non-goals

- Няма escape/кавички: `|` в име на сметка не се поддържа.
- Няма запис в репозиториите; publisher-ът само добавя, не ротира файла.
- Няма промяна в `src/domain/`, `src/application/`, `src/adapters/in/`,
  портовете, `package.json`; няма нови зависимости.
- Не е упражнение от EPIC-2 — нов EPIC-4.

## Impact

- Нови файлове: трите адаптера, `data/accounts.txt`,
  `data/fee-schedules.txt`, backlog `EPIC-4-text-files/`.
- Променени: `src/bootstrap/compose.ts` (нов export `reportFileFrom`),
  `.gitignore`, `scripts/pack-demo.ts`, `README.md`,
  `test/out-adapters.test.ts`, `test/bootstrap.test.ts`.
