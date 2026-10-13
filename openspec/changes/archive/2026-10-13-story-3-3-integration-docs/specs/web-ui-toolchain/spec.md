# Spec Delta

## MODIFIED Requirements

### Requirement: Генерираните файлове на ui не влизат в git и в архива
`ui/node_modules/` и `ui/dist/` SHALL са игнорирани от git. `npm run pack`
SHALL включва изходния код на `ui/` (включително `package.json` и
lockfile) и SHALL да не включва `ui/node_modules/` и `ui/dist/`.

#### Scenario: git status след install
- **WHEN** `cd ui && npm install` е изпълнен
- **THEN** `git status --porcelain` не показва `ui/node_modules/`, а `ui/package-lock.json` е проследен

#### Scenario: pack без ui/node_modules
- **WHEN** се изпълни `npm run pack` след `cd ui && npm install`
- **THEN** `tar -tzf hexa.tar.gz` съдържа `hexa/ui/package.json` и не съдържа запис под `hexa/ui/node_modules/`

#### Scenario: pack без ui/dist
- **GIVEN** `ui/dist/` съществува (след `cd ui && npm run build` или създадена на ръка)
- **WHEN** се изпълни `npm run pack`
- **THEN** `tar -tzf hexa.tar.gz` не съдържа запис под `hexa/ui/dist/`, а `hexa/ui/src/App.tsx` е вътре
