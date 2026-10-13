# Spec Delta

## Purpose

Определя стартовите файлове на проекта — какво прави процесът, когато
разработчик изпълни `npm run cli` или `npm run http`: откъде идват
аргументите и конфигурацията, какъв е exit кодът, на кой порт се слуша и
какво се вижда при невалидна конфигурация.

## ADDED Requirements

### Requirement: CLI entry point-ът подава аргументите на CLI адаптера и връща exit кода
`src/bootstrap/cli.main.ts` SHALL сглоби use case-а през composition root-а
от `process.env`, SHALL подаде на CLI адаптера аргументите след името на
скрипта и процесните потоци, и SHALL завърши с exit кода, върнат от
адаптера, без да вика `process.exit`.

#### Scenario: Успешно изчисление през memory
- **GIVEN** `STORAGE` не е зададен
- **WHEN** се изпълни `node --import tsx src/bootstrap/cli.main.ts hh-1 2026-01-01 2026-03-31 --json`
- **THEN** exit кодът е `0`, stdout е един JSON ред с `total 14239.73`, а stderr съдържа `[bootstrap] STORAGE=memory` и реда `[publish] household hh-1 …`

#### Scenario: Същият резултат през json
- **GIVEN** `STORAGE=json`
- **WHEN** се изпълни същата команда
- **THEN** exit кодът е `0`, stdout е байт за байт същият JSON ред, stderr съдържа `[bootstrap] STORAGE=json`

#### Scenario: Usage грешка
- **WHEN** се изпълни entry point-ът само с `hh-1`
- **THEN** exit кодът е `2`, stderr съдържа `usage:`, stdout е празен

#### Scenario: Domain грешка
- **WHEN** се изпълни entry point-ът с `hh-404 2026-01-01 2026-03-31`
- **THEN** exit кодът е `1`, stderr съдържа `HOUSEHOLD_NOT_FOUND`, stdout е празен

### Requirement: HTTP entry point-ът слуша на PORT и съобщава реалния порт
`src/bootstrap/http.main.ts` SHALL сглоби use case-а от `process.env`, SHALL
създаде HTTP адаптера и SHALL слуша на `Number(process.env.PORT)` или на
`3000`, ако `PORT` липсва или е празен. След като сървърът слуша, SHALL
пише на stderr един ред `[bootstrap] listening on http://localhost:<порт>`
с реалния порт, върнат от сървъра, и SHALL не пише нищо на stdout.

#### Scenario: Ефимерен порт
- **GIVEN** `PORT=0`
- **WHEN** entry point-ът бъде стартиран като дъщерен процес
- **THEN** stderr получава ред `[bootstrap] listening on http://localhost:<N>` с `N > 0`, и `POST http://localhost:<N>/households/hh-1/fees` с `{ "from": "2026-01-01", "to": "2026-03-31" }` връща `200` и `total 14239.73`

#### Scenario: Порт по подразбиране
- **GIVEN** `PORT` не е зададен
- **WHEN** entry point-ът се стартира
- **THEN** лог редът е `[bootstrap] listening on http://localhost:3000`

#### Scenario: HTTP през json storage
- **GIVEN** `PORT=0` и `STORAGE=json`
- **WHEN** се изпрати същата заявка
- **THEN** отговорът е deepEqual на отговора при memory, stderr съдържа `[bootstrap] STORAGE=json`

#### Scenario: Процесът остава жив
- **GIVEN** стартиран HTTP entry point
- **WHEN** мине време без заявки
- **THEN** процесът не завършва сам; завършва, когато получи сигнал за спиране

### Requirement: Невалидна конфигурация спира процеса с ненулев код и ясно съобщение
Когато composition root-ът хвърли при стартиране (например `STORAGE=sqlite`),
и двата entry point-а SHALL завършат с ненулев exit код, SHALL не пишат нищо
на stdout, и stderr SHALL съдържа съобщението на грешката с получената и
позволените стойности.

#### Scenario: CLI с непознат STORAGE
- **GIVEN** `STORAGE=sqlite`
- **WHEN** се изпълни CLI entry point-ът с валидни аргументи
- **THEN** exit кодът е ненулев, stdout е празен, stderr съдържа `STORAGE`, `sqlite`, `memory` и `json`

#### Scenario: HTTP с непознат STORAGE
- **GIVEN** `STORAGE=sqlite`, `PORT=0`
- **WHEN** се стартира HTTP entry point-ът
- **THEN** процесът завършва с ненулев код, без ред `listening`, stderr съдържа `STORAGE` и `sqlite`
