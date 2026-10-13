# Tasks

## 1. TASK-1.1.1 package.json и скриптове

- [ ] 1.1 (SUB-1.1.1.2) Създай `package.json` с `name`, `private: true`, `"type": "module"`, `engines.node: ">=22"` и dev зависимости `typescript`, `tsx`, `@types/node`; изпълни `npm install` и провери, че `package-lock.json` е създаден и в `node_modules/` няма пакети извън трите и транзитивните им.
- [ ] 1.2 (SUB-1.1.1.1) Добави скриптовете `cli`, `http`, `test`, `typecheck` по design.md D1 и провери с `npm run` , че четирите са изброени; `npm run cli` трябва да падне с грешка за липсващ `src/bootstrap/cli.main.ts`.
- [ ] 1.3 Напиши `test/skeleton.test.ts` (node:test), който чете `package.json` и assert-ва `type === "module"` и липса на `dependencies`; провери, че `npm test` го открива и минава (1 тест, код 0).
- [ ] 1.4 `npm run typecheck && npm test` минават.

## 2. TASK-1.1.2 tsconfig.json

- [ ] 2.1 (SUB-1.1.2.1) Създай `tsconfig.json` по design.md D2 (`strict`, `NodeNext`, `noEmit`, `allowImportingTsExtensions`, `verbatimModuleSyntax`, `noUncheckedIndexedAccess`, `include: ["src","test"]`); провери, че `npm run typecheck` минава с код 0 върху празен `src/` и не създава `.js`/`.d.ts` файлове.
- [ ] 2.2 Провери негативния случай: временно добави `const n: number = "x"` в `test/skeleton.test.ts`, увери се, че `npm run typecheck` пада с ненулев код и сочи файла/реда, после го махни.
- [ ] 2.3 (SUB-1.1.2.2) Допълни `.gitignore` с `*.tsbuildinfo`, `*.log`, `.DS_Store` без да пипаш съществуващите редове; провери с `git status --porcelain`, че `node_modules/` и `package-lock.json` са съответно игнориран / untracked.
- [ ] 2.4 `npm run typecheck && npm test` минават.

## Workflow follow-up

- `/opsx:archive story-1-1-skeleton` — сменя status на STORY-1.1, TASK-1.1.x и SUB-1.1.x.y на `done`.
- `/commit`, после `/clear`.
