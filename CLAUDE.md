# hexa-lab

Учебен мини billing проект: Hexagonal Architecture (Ports & Adapters) върху
tiered такси по AUM. TypeScript ESM, Node 24, `tsx`, `node:test`. Без
framework-и и без runtime зависимости.

## Как се работи

Източник на истината за *какво* правим е `backlog/`. *Как* го правим се
описва и проследява с OpenSpec. Една OpenSpec change = една STORY от backlog-а.

```
backlog/STORY-x.y  →  /opsx:propose  →  /opsx:apply  →  /opsx:archive  →  /clear
   (какво)            (план)            (код)           (спецове + done)   (нов контекст)
```

1. **Избери story** от `backlog/README.md` (дървото) — първата със `status: todo`
   в ред на номерата. Прочети нейния `STORY-x.y.md`, тасковете и събтасковете.
2. **`/opsx:propose story-x-y-<slug>`** — създава `openspec/changes/<име>/` с
   `proposal.md`, `design.md`, `specs/<capability>/spec.md`, `tasks.md`.
   Proposal-ът изброява покритите backlog ID-та. Tasks са групирани по TASK.
   Само планиране — не пипа код. Прегледай артефактите преди следващата стъпка.
3. **`/opsx:apply`** — имплементира `tasks.md` задача по задача. Тест преди код.
   След всяка група: `npm run typecheck && npm test`.
4. **`/opsx:verify`** (по желание) — проверява код срещу spec/design/tasks.
5. **`/opsx:archive`** — мърджва delta spec-овете в `openspec/specs/`, мести
   change-а в `openspec/changes/archive/`, сменя `status: done` на покритите
   backlog елементи.
6. **`/commit`** — комит след archive (или след apply, ако story-то е голямо).
7. **`/clear`** — след archive (и commit) потребителят чисти контекста, за да
   започне следващото story на чисто. Claude не може да го направи сам, затова
   archive-ът завършва с напомняне за `/clear`.

Останалите команди: `/opsx:explore` (мислене без артефакти), `/opsx:continue`
(един артефакт наведнъж), `/opsx:ff` (всички артефакти без пауза),
`/opsx:update` (редакция на change), `/opsx:sync` (spec-ове без archive),
`/opsx:bulk-archive`, `/opsx:onboard`.

## Правила

- Слоеве в `src/`: `domain/` → `application/` → `adapters/in|out/` → `bootstrap/`.
  Правилото за зависимостите е в `openspec/config.yaml` и се пази от
  `test/architecture.test.ts`.
- Статусът на backlog елемент живее само във frontmatter (`todo` →
  `in-progress` → `done`). При старт на apply сложи `in-progress` на story-то.
- Артефактите на OpenSpec са на български; код, идентификатори и commit
  съобщения на английски.
- Commit съобщения: imperative изречение, без prefix, без trailers.
- Не добавяй runtime зависимости. Dev: само `typescript`, `tsx`, `@types/node`.
