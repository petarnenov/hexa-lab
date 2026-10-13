---
id: EPIC-3
type: epic
title: "Web UI: малък, но хубав"
status: todo
---

# EPIC-3 Web UI: малък, но хубав

Трети driving клиент към хексагона: малък React UI в тъмна тема, който вика
`POST /households/:id/fees` на HTTP адаптера и показва отчета. Един екран,
една форма, една таблица. Целта е да се види, че UI-ят е просто още един
външен свят зад порта - сървърът не се променя заради него.

Стек: React + Vite + TypeScript, TanStack Query (React Query) за заявката,
Vitest + Testing Library за тестове. Без UI библиотека: тъмната тема е
собствени CSS променливи.

## Ограничения

- UI-ят живее в `ui/` като отделен npm пакет със собствен `package.json`.
  Коренът на проекта остава без runtime зависимости; правилото от CLAUDE.md
  важи за `src/`, не за `ui/`.
- `ui/` не импортира нищо от `src/`. Говори със сървъра само по HTTP, през
  Vite proxy (`/households` → `http://localhost:3000`), така че в
  `createHttpServer.ts` не се добавя CORS.
- `test/architecture.test.ts` не се пипа: `ui/` е извън `src/`.

## Критерии за приемане

- `cd ui && npm test` и `npm run typecheck` минават; `npm test` в корена не е засегнат.
- При работещ `npm run http`, `npm run ui` показва за `hh-1`, 2026-01-01..2026-03-31
  трите реда и `total 14 239.73` - същите числа като CLI и curl.
- Грешка от сървъра (`hh-404`) се показва в UI-я с кода и съобщението, без crash.
- Екранът е в тъмна тема, чете се на телефон и на desktop.

## Истории

- [STORY-3.1 Скелет на UI](STORY-3.1-ui-skeleton/STORY-3.1.md)
- [STORY-3.2 Екран „Такси на household“](STORY-3.2-fees-screen/STORY-3.2.md)
- [STORY-3.3 Интеграция и документация](STORY-3.3-integration-docs/STORY-3.3.md)
