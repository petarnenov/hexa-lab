# Spec Delta

## ADDED Requirements

### Requirement: Скриптове ui и ui:test делегират към пакета ui/
Кореновият `package.json` SHALL има скриптове `ui` и `ui:test`, които
изпълняват съответно `dev` и `test` на пакета `ui/` чрез `npm --prefix ui`,
без да добавят зависимости в кореновия пакет. Правилото „без runtime
зависимости“ SHALL важи за кореновия `package.json`; `ui/` е отделен пакет
със собствени зависимости.

#### Scenario: Старт на UI от корена
- **GIVEN** `cd ui && npm install` е изпълнен
- **WHEN** разработчик изпълни `npm run ui` от корена
- **THEN** стартира Vite dev сървърът на `ui/`

#### Scenario: UI тестове от корена
- **WHEN** разработчик изпълни `npm run ui:test` от корена
- **THEN** се изпълняват тестовете на `ui/` и кодът на изход е техният

#### Scenario: Кореновият npm test не е засегнат
- **WHEN** разработчик изпълни `npm test` от корена
- **THEN** се изпълняват само `test/*.test.ts` с `node:test`, без UI тестовете
