# Backlog

Файлов заместител на Jira: епик → стори → таск → събтаск. Всяко ниво е папка,
а най-долното (събтаск) е отделен `.md` файл.

## Конвенции

- **ID-та**: `EPIC-1`, `STORY-1.2`, `TASK-1.2.3`, `SUB-1.2.3.4`. Номерът казва и родителя.
- **Папки**: `EPIC-<n>-<slug>/STORY-<n.n>-<slug>/TASK-<n.n.n>-<slug>/SUB-<n.n.n.n>-<slug>.md`.
- **Индексен файл**: всяка папка има `<ID>.md` с описание и линкове към децата.
- **Frontmatter** във всеки файл: `id`, `type` (epic|story|task|subtask), `title`, `status`, `parent`.
- **Статуси**: `todo` → `in-progress` → `done`. Статусът живее само във frontmatter,
  затова няма чекбоксове, които да се разминават с него.
- **Критерии за приемане** има на ниво епик и стори; събтасковете имат „Готово когато“.
- Нова работа: създай папка/файл със следващия номер и добави линк в индекса на родителя.

## Полезни команди (macOS и Linux)

```bash
# всички отворени елементи
grep -rl '^status: todo' backlog

# какво е в работа
grep -rl '^status: in-progress' backlog

# смени статус на един елемент
sed -i.bak 's/^status: todo/status: done/' path/to/SUB-1.2.2.1-annual-tiered.md && rm path/to/*.bak
```

(`sed -i.bak` работи еднакво с GNU и BSD sed.)

## Дърво

```text
EPIC-1  Хексагонален мини billing
  STORY-1.1  Скелет на проекта
    TASK-1.1.1  package.json и скриптове
      SUB-1.1.1.1  Скриптове cli/http/test/typecheck
      SUB-1.1.1.2  Dev зависимости
    TASK-1.1.2  tsconfig.json
      SUB-1.1.2.1  Compiler options
      SUB-1.1.2.2  .gitignore
  STORY-1.2  Domain: tiered такси
    TASK-1.2.1  Типове Account, FeeSchedule, BillingPeriod
      SUB-1.2.1.1  Account.ts
      SUB-1.2.1.2  FeeSchedule.ts
      SUB-1.2.1.3  BillingPeriod.ts
    TASK-1.2.2  tieredFee.ts
      SUB-1.2.2.1  annualTieredFee
      SUB-1.2.2.2  Валидация на тарифа
      SUB-1.2.2.3  feeForPeriod и roundToCents
    TASK-1.2.3  FeeReport и грешки
      SUB-1.2.3.1  FeeReport.ts
      SUB-1.2.3.2  errors.ts
  STORY-1.3  Портове in/out
    TASK-1.3.1  Inbound порт
      SUB-1.3.1.1  CalculateHouseholdFees.ts
    TASK-1.3.2  Outbound портове
      SUB-1.3.2.1  AccountRepository.ts
      SUB-1.3.2.2  FeeScheduleRepository.ts
      SUB-1.3.2.3  FeeReportPublisher.ts
  STORY-1.4  Use case: изчисли таксите на household
    TASK-1.4.1  CalculateHouseholdFeesService
      SUB-1.4.1.1  Конструктор с портове
      SUB-1.4.1.2  Поток на execute
      SUB-1.4.1.3  Грешки на use case-а
  STORY-1.5  Тестове
    TASK-1.5.1  test/domain.test.ts
      SUB-1.5.1.1  Кейсове за нивата
      SUB-1.5.1.2  Минимум и закръгляне
      SUB-1.5.1.3  Период
    TASK-1.5.2  test/calculate-fees.test.ts
      SUB-1.5.2.1  Успешен път
      SUB-1.5.2.2  Грешки
    TASK-1.5.3  test/architecture.test.ts
      SUB-1.5.3.1  Парсер на import-и
      SUB-1.5.3.2  Таблица с правила по слоеве
      SUB-1.5.3.3  Само-проверка на парсера
  STORY-1.6  Out адаптери
    TASK-1.6.1  InMemory репозиторита
      SUB-1.6.1.1  InMemoryAccountRepository
      SUB-1.6.1.2  InMemoryFeeScheduleRepository
    TASK-1.6.2  JsonFile репозиторита
      SUB-1.6.2.1  JsonFileAccountRepository
      SUB-1.6.2.2  JsonFileFeeScheduleRepository
      SUB-1.6.2.3  data/accounts.json и data/fee-schedules.json
    TASK-1.6.3  ConsoleFeeReportPublisher
      SUB-1.6.3.1  Формат на реда
  STORY-1.7  In адаптери: HTTP и CLI
    TASK-1.7.1  HTTP адаптер
      SUB-1.7.1.1  Рутиране
      SUB-1.7.1.2  Парсване на тялото
      SUB-1.7.1.3  Превод на грешки
    TASK-1.7.2  CLI адаптер
      SUB-1.7.2.1  Аргументи
      SUB-1.7.2.2  Табличен изход
      SUB-1.7.2.3  --json изход
  STORY-1.8  Bootstrap: composition root
    TASK-1.8.1  compose.ts
      SUB-1.8.1.1  Избор по STORAGE
      SUB-1.8.1.2  Път до data/
      SUB-1.8.1.3  seed.ts
    TASK-1.8.2  Entry points
      SUB-1.8.2.1  cli.main.ts
      SUB-1.8.2.2  http.main.ts
  STORY-1.9  README и демо
    TASK-1.9.1  README.md
      SUB-1.9.1.1  Хексагонът с ASCII диаграма
      SUB-1.9.1.2  Стартиране и смяна на storage
      SUB-1.9.1.3  Секция Упражнения
    TASK-1.9.2  Финално демо
      SUB-1.9.2.1  CLI с memory и json
      SUB-1.9.2.2  HTTP с memory и json
      SUB-1.9.2.3  Доставка
EPIC-2  Упражнения (за самостоятелна работа)
  STORY-2.1  SQLite адаптер за AccountRepository
    TASK-2.1.1  Нов адаптер
      SUB-2.1.1.1  Схема и seed
      SUB-2.1.1.2  Връзване в bootstrap
      SUB-2.1.1.3  Общ contract тест
  STORY-2.2  MCP tool като driving adapter
    TASK-2.2.1  Нов адаптер в adapters/in/mcp
      SUB-2.2.1.1  Дефиниция на tool-а
      SUB-2.2.1.2  Entry point в bootstrap
  STORY-2.3  Outbound порт Clock
    TASK-2.3.1  Порт и адаптери
      SUB-2.3.1.1  Clock интерфейс
      SUB-2.3.1.2  SystemClock и FixedClock
  STORY-2.4  Use case „preview fees“ без publish
    TASK-2.4.1  Нов use case
      SUB-2.4.1.1  PreviewHouseholdFees порт
      SUB-2.4.1.2  Маршрут и CLI флаг
  STORY-2.5  Счупи правилото за зависимостите
    TASK-2.5.1  Експеримент
      SUB-2.5.1.1  Добави забранен import
      SUB-2.5.1.2  Пусни npm test и върни
EPIC-3  Web UI: малък, но хубав
  STORY-3.1  Скелет на UI
    TASK-3.1.1  Vite проект
      SUB-3.1.1.1  package.json и скриптове
      SUB-3.1.1.2  vite.config.ts с proxy
      SUB-3.1.1.3  tsconfig.json и .gitignore
    TASK-3.1.2  Тъмна тема и App shell
      SUB-3.1.2.1  Design tokens
      SUB-3.1.2.2  App shell
    TASK-3.1.3  Vitest
      SUB-3.1.3.1  Setup файл
      SUB-3.1.3.2  Smoke тест на App
  STORY-3.2  Екран „Такси на household“
    TASK-3.2.1  API клиент
      SUB-3.2.1.1  Типове FeeReport
      SUB-3.2.1.2  calculateFees
      SUB-3.2.1.3  ApiError
    TASK-3.2.2  Форма
      SUB-3.2.2.1  Полета и defaults
      SUB-3.2.2.2  Submit през useMutation
    TASK-3.2.3  Отчет
      SUB-3.2.3.1  Таблица с редове
      SUB-3.2.3.2  Total и период
      SUB-3.2.3.3  Състояния idle/loading/error
    TASK-3.2.4  Тестове
      SUB-3.2.4.1  Успешен път
      SUB-3.2.4.2  Грешки от сървъра
  STORY-3.3  Интеграция и документация
    TASK-3.3.1  README
      SUB-3.3.1.1  Секция UI
      SUB-3.3.1.2  Диаграма и правила
    TASK-3.3.2  Демо и pack
      SUB-3.3.2.1  pack включва ui/
      SUB-3.3.2.2  Ръчна приемка
EPIC-4  Текстови файлове като driven адаптери
  STORY-4.1  TextFile адаптери за трите outbound порта
    TASK-4.1.1  TextFile репозиторита
      SUB-4.1.1.1  TextFileAccountRepository
      SUB-4.1.1.2  TextFileFeeScheduleRepository
      SUB-4.1.1.3  data/accounts.txt и data/fee-schedules.txt
    TASK-4.1.2  TextFileFeeReportPublisher
      SUB-4.1.2.1  Формат на блока
    TASK-4.1.3  Връзване в bootstrap и README
      SUB-4.1.3.1  compose.ts
      SUB-4.1.3.2  README
```
