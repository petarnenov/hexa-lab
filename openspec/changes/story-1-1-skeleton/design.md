# Design

## Context

Repo-то е празно откъм код (вж. proposal.md — Why). Локално: Node 24.21,
npm 11. Целевата среда е Node >= 22, защото оттам `node --test` приема glob
аргументи и `--import tsx` е стабилен път за TS без компилация.

Ограничения от проекта: без runtime зависимости, dev само `typescript`, `tsx`,
`@types/node`; код и идентификатори на английски.

## Goals / Non-Goals

**Goals:**
- Един `package.json` и един `tsconfig.json`, които следващите осем stories
  не трябва да пипат.
- `npm run typecheck && npm test` зелено веднага след този change.

**Non-Goals:**
- Emit/build стъпка — проектът се пуска само през `tsx`.
- Отделен `tsconfig` за тестовете — един конфиг покрива `src/` и `test/`.

## Decisions

### D1. `tsx` чрез `--import`, не чрез `tsx` binary като runner
Скриптове:
```json
"cli":       "tsx src/bootstrap/cli.main.ts",
"http":      "tsx src/bootstrap/http.main.ts",
"test":      "node --import tsx --test \"test/*.test.ts\"",
"typecheck": "tsc --noEmit"
```
- `test` ползва `node --test` (а не `tsx --test`), за да е ясно, че runner-ът е
  вграденият `node:test`; `tsx` само регистрира loader-а. Glob-ът е в кавички,
  за да го разширява самият Node (еднакво на macOS/Linux), а не shell-ът.
- `cli`/`http` ползват `tsx` директно — по-кратко, същият loader. Аргументи
  след `--` стигат до `process.argv` без промяна.
- Алтернатива: `ts-node` — отхвърлена, по-бавен и ESM поддръжката изисква
  допълнителни флагове.

### D2. Compiler options
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noEmit": true,
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "noUncheckedIndexedAccess": true,
    "types": ["node"],
    "skipLibCheck": true
  },
  "include": ["src", "test"]
}
```
- `NodeNext` + `allowImportingTsExtensions`: import-ите в кода са `./x.ts`,
  точно както ги изпълнява `tsx`. Това е и формата, която
  `test/architecture.test.ts` (STORY-1.5) ще парсва.
- `verbatimModuleSyntax`: принуждава `import type` за типове — важно за
  портовете (STORY-1.3), които са чисти интерфейси.
- `noUncheckedIndexedAccess`: tiered таблицата (STORY-1.2) се индексира по
  масив; опцията прави `undefined` случая явен.
- `types: ["node"]`: без него `tsc` зарежда всички `@types/*`; тук само Node.
- `skipLibCheck`: ускорява typecheck; не проверяваме чужди `.d.ts`.
- Алтернатива `module: "ESNext"` + `bundler` resolution — отхвърлена, не
  отразява как Node реално резолва модулите.

### D3. Smoke тест вместо празни папки
`tsc` гърми с TS18003 при `include` без нито един файл, а `node --test` без
съвпадащ файл връща грешка. Затова change-ът добавя `test/skeleton.test.ts`:
един тест, който чете `package.json` и проверява `"type": "module"` и че няма
`dependencies`. Той е и жив тест за правилото „без runtime зависимости“.
`src/` остава празен (git не пази празни папки; появява се в STORY-1.2).

### D4. `engines.node >= 22`, без `engine-strict`
Декларира се за документация и предупреждение при `npm install`; не блокира.
Локалният Node е 24, CLAUDE.md казва Node 24 — `>=22` покрива и двете.

### D5. `.gitignore` се допълва, не се пренаписва
Съществуващите редове (`node_modules/`, `*.bak`) остават; добавят се
`*.tsbuildinfo`, `*.log`, `.DS_Store`.

## Risks / Trade-offs

- [`allowImportingTsExtensions` изисква `noEmit`] → проектът никога не прави
  emit; ако някога трябва build, ще мине през `tsx`/`esbuild`, не през `tsc`.
- [`node --test` glob поведение се различава в Node < 22] → `engines` го
  документира; smoke тестът го хваща веднага.
- [`cli`/`http` са счупени до STORY-1.8] → записано като non-goal в
  proposal-а и като сценарий в spec-а; не се маскира с placeholder файлове.
