# web-ui-api-client Specification

## Purpose

Определя как UI-ят говори със сървъра: заявката към `POST /households/:id/fees`,
формата на отчета, който очаква, и как всяка грешка - HTTP статус с JSON тяло,
не-JSON отговор или мрежова - се превръща в една структурирана грешка с
`status` и `code`, така че компонентите не знаят за `fetch`.

## Requirements

### Requirement: Отчетът е копие на JSON договора на HTTP адаптера
UI-ят SHALL описва отчета с типове, които съвпадат поле по поле с JSON-а на
`POST /households/:id/fees`: `householdId`, `period { from, to }`,
`lines[] { accountId, accountName, aum, feeScheduleId, fee }`, `total`.
Типовете SHALL са дефинирани в `ui/` и SHALL не са импортирани от `src/`.

#### Scenario: Отговорът от README се чете без преобразуване
- **GIVEN** JSON тялото за `hh-1` Q1 2026 от README (три реда, `total: 14239.73`)
- **WHEN** клиентът го получи като отговор
- **THEN** връща го като отчет с три реда, `householdId = "hh-1"`, `period.from = "2026-01-01"`, `total = 14239.73`, без промяна на полета

#### Scenario: Няма зависимост от src/
- **WHEN** се проверят import-ите на файловете под `ui/src/api/`
- **THEN** никой не сочи към `../../src` или друг път извън `ui/`

### Requirement: calculateFees изпраща POST с JSON тяло
Клиентът SHALL изпълнява `POST /households/<householdId>/fees` с
`householdId` URL-кодиран, header `content-type: application/json` и тяло
`{"from":"<from>","to":"<to>"}`. При `2xx` SHALL връща тялото като отчет.
Пътят SHALL е относителен (same-origin), за да минава през Vite proxy-то.

#### Scenario: Заявка с defaults
- **GIVEN** `fetch` е mock-нат и връща `200` с отчета за `hh-1`
- **WHEN** се извика `calculateFees({ householdId: "hh-1", from: "2026-01-01", to: "2026-03-31" })`
- **THEN** `fetch` е извикан веднъж с URL `/households/hh-1/fees`, метод `POST`, header `content-type: application/json` и тяло `{"from":"2026-01-01","to":"2026-03-31"}`, и резултатът е отчетът

#### Scenario: Идентификатор със специален знак
- **GIVEN** mock-нат `fetch`
- **WHEN** `householdId` е `"hh 1"`
- **THEN** URL-ът е `/households/hh%201/fees`

### Requirement: Не-2xx отговор става ApiError със status и code
При статус извън `2xx` клиентът SHALL хвърля грешка с `status` равен на HTTP
статуса, `code` равен на полето `error` от JSON тялото и `message` равен на
полето `message`. Грешката SHALL е разпознаваема по тип (не по текст).

#### Scenario: 404 Household not found
- **GIVEN** `fetch` връща `404` с тяло `{"error":"HOUSEHOLD_NOT_FOUND","message":"Household not found: hh-404"}`
- **WHEN** се извика `calculateFees` за `hh-404`
- **THEN** промисът е отхвърлен с `ApiError`, `status = 404`, `code = "HOUSEHOLD_NOT_FOUND"`, `message = "Household not found: hh-404"`

#### Scenario: 400 Invalid billing period
- **GIVEN** `fetch` връща `400` с тяло `{"error":"INVALID_BILLING_PERIOD","message":"from (2026-03-31) must not be after to (2026-01-01)"}`
- **WHEN** се извика `calculateFees`
- **THEN** грешката има `status = 400`, `code = "INVALID_BILLING_PERIOD"` и същото съобщение

#### Scenario: 500 Internal error
- **GIVEN** `fetch` връща `500` с тяло `{"error":"INTERNAL_ERROR","message":"Internal server error"}`
- **WHEN** се извика `calculateFees`
- **THEN** грешката има `status = 500` и `code = "INTERNAL_ERROR"`

### Requirement: Не-JSON отговор и мрежова грешка стават NETWORK_ERROR
Когато тялото на отговор извън `2xx` не е JSON обект с низ `error` (напр.
HTML от proxy-то при спрян backend) или когато `fetch` отхвърли промиса
(мрежа, proxy down), клиентът SHALL хвърля `ApiError` с
`code = "NETWORK_ERROR"` и четимо съобщение. При отхвърлен `fetch` `status`
SHALL е `0`; при не-JSON тяло `status` SHALL е HTTP статусът.

#### Scenario: Proxy връща HTML при спрян backend
- **GIVEN** `fetch` връща `502` с тяло `<html>Bad Gateway</html>` и `content-type: text/html`
- **WHEN** се извика `calculateFees`
- **THEN** грешката е `ApiError` с `status = 502`, `code = "NETWORK_ERROR"` и съобщение, което не е празно и не е суровия HTML

#### Scenario: fetch отхвърля
- **GIVEN** `fetch` отхвърля с `TypeError("Failed to fetch")`
- **WHEN** се извика `calculateFees`
- **THEN** грешката е `ApiError` с `status = 0`, `code = "NETWORK_ERROR"` и съобщение, което съдържа оригиналния текст
