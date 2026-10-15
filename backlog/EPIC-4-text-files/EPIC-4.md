---
id: EPIC-4
type: epic
title: "Текстови файлове като driven адаптери"
status: done
---

# EPIC-4 Текстови файлове като driven адаптери

Трета технология зад същите outbound портове: обикновени `.txt` файлове,
които човек редактира във всеки редактор. И трите порта получават txt
адаптер - двете хранилища и publisher-а - без промяна в domain/ и
application/.

## Критерии за приемане

- `STORAGE=txt` дава за `hh-1`, Q1 2026 `total 14239.73`, същия отчет като memory и json.
- `PUBLISHER=txt` добавя всеки отчет към текстов файл.
- `src/domain/`, `src/application/` и `src/adapters/in/` не са променени.

## Истории

- [STORY-4.1 TextFile адаптери за трите outbound порта](STORY-4.1-text-file-adapters/STORY-4.1.md)
