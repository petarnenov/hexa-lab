# Proposal

## Why

Repo-то още няма нито един ред TypeScript: само backlog, OpenSpec и CLAUDE.md.
Всички следващи stories (domain, портове, тестове, адаптери) разчитат на
работещ toolchain — ESM, `tsx`, `node:test`, strict typecheck — затова той
трябва да е първи и да е еднакъв на macOS и Linux.

## What Changes

- Нов `package.json`: `"type": "module"`, `engines.node >= 22`, скриптове
  `cli`, `http`, `test`, `typecheck`; dev зависимости само `typescript`, `tsx`,
  `@types/node`. Без runtime зависимости.
- Нов `tsconfig.json`: strict ESM без emit (`strict`, `NodeNext`, `noEmit`,
  `allowImportingTsExtensions`, `verbatimModuleSyntax`,
  `noUncheckedIndexedAccess`).
- Разширен `.gitignore`: `node_modules/` и временни файлове (`*.bak` вече е
  там; добавят се `*.tsbuildinfo`, `*.log`, `.DS_Store`).
- Нов `test/skeleton.test.ts` — минимален smoke тест, който доказва, че
  `node:test` + `tsx` работят, и дава на `tsc` поне един входен файл, за да
  не гърми с „No inputs were found“ върху празен `src/`.
- Генериран `package-lock.json` (комитва се).

## Покрити backlog елементи

- STORY-1.1 Скелет на проекта
  - TASK-1.1.1 package.json и скриптове
    - SUB-1.1.1.1 Скриптове cli/http/test/typecheck
    - SUB-1.1.1.2 Dev зависимости
  - TASK-1.1.2 tsconfig.json
    - SUB-1.1.2.1 Compiler options
    - SUB-1.1.2.2 .gitignore

## Capabilities

### New Capabilities

- `project-toolchain`: наблюдаемото поведение на npm скриптовете, на които
  разчита целият проект — как се стартират CLI и HTTP entry point-ите, как се
  откриват и изпълняват тестовете, какво означава „typecheck минава“, и
  ограничението да няма runtime зависимости.

### Modified Capabilities

(няма — първи spec в проекта)

## Non-goals

- Никакъв код в `src/` — domain, портове, адаптери и bootstrap идват в
  STORY-1.2 … 1.8. Скриптовете `cli` и `http` сочат към
  `src/bootstrap/cli.main.ts` / `http.main.ts`, които се появяват чак в
  STORY-1.8; дотогава стартирането им е очаквано да е неуспешно.
- Без lint/format инструменти (eslint, prettier) — не са в backlog-а и биха
  добавили dev зависимости извън разрешените три.
- Без CI конфигурация.
- Без `architecture.test.ts` — това е STORY-1.5.

## Impact

- Нови файлове: `package.json`, `package-lock.json`, `tsconfig.json`,
  `test/skeleton.test.ts`; променен `.gitignore`.
- Нова папка `node_modules/` локално (игнорирана).
- Всички следващи stories зависят от тези скриптове и compiler options
  (особено `allowImportingTsExtensions` — import-ите в кода ще са с `.ts`
  разширение, което `test/architecture.test.ts` ще парсва).
