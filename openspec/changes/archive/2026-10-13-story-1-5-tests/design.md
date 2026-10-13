# Design

## Context

Съществуват `src/domain/` (6 файла) и `src/application/` (сервиз + 4 порта);
`adapters/` и `bootstrap/` още ги няма. Тестовете са `node:test`, пускат се с
`node --import tsx --test "test/*.test.ts"`, `tsconfig.json` включва и `test/`.
Проектът няма и няма да има runtime зависимости, така че архитектурният тест
трябва да е самодостатъчен: `node:fs`, `node:path`, `node:test`, regex.

TASK-1.5.1 и TASK-1.5.2 са покрити от STORY-1.2 и STORY-1.4 (вж. proposal.md);
единствената нова работа е TASK-1.5.3.

## Goals / Non-Goals

**Goals**
- Правилото за зависимостите от `openspec/config.yaml` да се проверява при
  всяко `npm test`, за всеки файл под `src/`, включително бъдещите.
- Нарушение → едно ясно съобщение с файл, specifier, слой-източник,
  слой-цел.
- Тестът да не може да минава „на празно“.

**Non-Goals**
- Пълен TS парсер, инструменти, цикли, type-only import-и като изключение.

## Decisions

### D1. Един файл, три части: парсер, правила, обход

`test/architecture.test.ts` съдържа три чисти функции и тестовете им:

```ts
type Layer = "domain" | "application" | "adapters/in" | "adapters/out" | "bootstrap";
type Target = Layer | "external";
type Dependency = { file: string; specifier: string }; // file спрямо корена на репото, напр. "src/domain/x.ts"
type Violation = Dependency & { message: string };

function importSpecifiers(source: string): string[];                   // SUB-1.5.3.1
function layerOf(pathFromSrc: string): Layer | undefined;              // SUB-1.5.3.2
function violationsOf(deps: readonly Dependency[]): Violation[];       // SUB-1.5.3.2
function dependenciesIn(dir: string): Dependency[];                    // обход (D5)
```

Помощни: `stripComments`, `resolveFromSrc`, `ruleMessage` (връща
съобщението за една зависимост или `undefined`), `tsFilesUnder`.

Защо функции, а не само един голям тест: само-проверката (SUB-1.5.3.3) трябва
да подава синтетичен вход на парсера и на правилата поотделно. Функциите
живеят в тестовия файл, не в `src/` — не са продукт, а пазач. Алтернатива
`test/helpers/arch.ts` се отхвърля: `npm test` глобва само `test/*.test.ts`,
а допълнителна папка усложнява без полза при ~60 реда helper код.

### D2. Парсер: махни коментарите, после regex

1. `stripComments(source)`: премахва `/* … */` (non-greedy, multiline) и
   `//…` до края на реда. Наивно спрямо низове, съдържащи `//` (напр. URL в
   низ) — приема се: в `src/` няма такива; ако се появят, коментарът в теста
   казва как да се разшири.
2. Четири regex-а върху почистения код, всички със `g` флаг и захват на
   specifier-а в единични или двойни кавички:
   - `/\bimport\s+[^"'()]*?\s+from\s*["']([^"']+)["']/g` — `import x from`,
     `import { a } from`, `import type { T } from`, `import * as ns from`
   - `/\bexport\s+[^"'()]*?\s+from\s*["']([^"']+)["']/g` — `export * from`,
     `export { a } from`, `export type { T } from`
   - `/\bimport\s*["']([^"']+)["']/g` — side-effect `import "x"`
   - `/\bimport\s*\(\s*["']([^"']+)["']\s*\)/g` — динамичен `import("x")`

   Резултатът се сортира по позиция в кода, за да е в ред на появяване
   независимо кой regex го е намерил.

   `type`-import-ите нарочно **се броят**: за хексагона type-зависимостта е
   зависимост (domain, който знае типа на порта, вече знае за application).

Защо не `typescript` compiler API: той е dev зависимост и би работил, но
целта на упражнението е да се види, че правилото е 20 реда без магия.

### D3. Резолвиране и слой

- Относителен specifier (`./`, `../`) → `resolveFromSrc`:
  `posix.normalize(posix.join(posix.dirname(fileFromSrc), specifier))` → път
  спрямо `src/` → `layerOf`.
- `layerOf`: първият сегмент; за `adapters` — първите два (`adapters/in`,
  `adapters/out`). Непознат → `undefined` → нарушение `not in any layer` (за
  източника) или `target … is not in any layer` (за import-а). Път, който
  излиза извън `src/` (започва с `..`), е отделно нарушение
  `import leaves src/` — различно съобщение, защото причината е различна
  (не „грешен слой“, а „не е в хексагона изобщо“).
- Неотносителен specifier (`node:…`, пакет) → `EXTERNAL`; позволен само в
  `adapters/in`, `adapters/out`, `bootstrap`.

Пътищата се нормализират до `/` (posix), за да е еднакво на macOS и Linux
(проектът не таргетира Windows, но `path.posix` е безплатно).

### D4. Таблица с правила като данни

```ts
const ALLOWED: Record<Layer, ReadonlySet<Layer | "external">> = {
  domain:         new Set(["domain"]),
  application:    new Set(["domain", "application"]),
  "adapters/in":  new Set(["domain", "application", "external"]),
  "adapters/out": new Set(["domain", "application", "external"]),
  bootstrap:      new Set(["domain", "application", "adapters/in", "adapters/out", "bootstrap", "external"]),
};
```

Таблицата е самото правило от `openspec/config.yaml`, преписано в код —
коментар над нея сочи към config-а и към ASCII хексагона (README, STORY-1.9).
`adapters/in → adapters/in` и `adapters/out → adapters/out` нарочно **не** са
в таблицата: един адаптер няма причина да импортира друг адаптер; при нужда
(напр. общ helper за два out адаптера) това се решава в design-а на STORY-1.6,
не тук.

### D5. Обход и доклад

- `tsFilesUnder(dir)` (в плана беше `walk`; преименувано, защото името
  казва какво връща): рекурсивно `readdirSync(..., { withFileTypes: true })`, събира
  `.ts` файлове, пропуска `.d.ts` и `.test.ts` (в `src/` няма такива, но
  правилото е евтино). Синхронно `fs` — тестът е малък, а синхронният код е
  по-четим за обучаващите се.
- `dependenciesIn("src")`: коренът на репото се взима от `import.meta.url`
  (`new URL("..", …)`), за да не зависи от cwd; за всеки файл
  `importSpecifiers(readFileSync)` → `Dependency[]` с repo-relative `file`.
  Зависимостите се събират веднъж в `describe("src/")` и се споделят от двата
  теста.
- Един `test("src/ obeys the dependency rule")` с
  `assert.deepEqual(violations, [], "\n" + messages.join("\n"))` — при
  нарушение `node:test` показва всички редове наведнъж. Формат на реда:
  `src/domain/x.ts -> ../adapters/out/y.ts: domain may not import adapters/out`;
  за външен модул: `… domain may not import external module node:fs/promises`.
  Проверено ръчно при apply с временен import в `src/domain/errors.ts`.
- Отделен `test("src/ has at least one import")`: `deps.length > 0`.

### D6. Само-проверка (SUB-1.5.3.3)

Тестове върху синтетичен вход, без досег с диска:
1. `importSpecifiers` върху низ с петте форми (вкл. `import type`) + ред и
   блок коментар с import → точно 5 specifier-а в ред на появяване, без
   закоментираните; празен низ / код без import → `[]`.
2. `layerOf` върху по един път от всеки слой + три пътя без слой
   (`util/…`, `adapters/shared.ts`, `index.ts`).
3. `violationsOf` върху едно нарушение на вид: `domain → ../adapters/out`,
   `adapters/in → ../out`, `domain → node:fs/promises`,
   `application → node:fs`, файл без слой, import извън `src/` — всяко дава
   точно 1 нарушение със съобщение, което назовава файла, specifier-а и
   слоевете.
4. `violationsOf` върху 13 позволени двойки от всичките пет слоя → `[]`.

Проверено и ръчно при apply: с `importSpecifiers` подменен да връща `[]`,
тестът „src/ has at least one import“ пада.

### D7. Ревизия на TASK-1.5.1 / TASK-1.5.2

Таблица „кейс от блупринта → тест“ се прави при apply и се записва в
коментара в началото на всеки от двата файла. Ако кейс липсва — добавя се
тест под съответния `describe`.

**Резултат при apply:** нищо не липсваше. Двата файла получиха само картата на
покритието в хедъра (и „extended by“ стана „reviewed by STORY-1.5“), а
коментарът на guard теста „без инфраструктура“ в `calculate-fees.test.ts`
вече казва, че допълва `architecture.test.ts` (съдържание vs. import-и), а не
че го замества временно.

## Risks / Trade-offs

- [Regex парсер пропуска екзотичен синтаксис (import в template literal,
  multiline specifier)] → приема се; `src/` е под наш контрол, а
  само-проверката ловú счупване на самия парсер, не на синтаксиса.
- [`stripComments` чупи низ с `//`] → приема се, документирано в коментар.
- [Guard тестовете от STORY-1.3/1.4 частично се дублират с този] → остават:
  те проверяват *съдържание* (`console.`, `process.env`, думи като `json`),
  което правилото за import-ите не вижда.
- [Бъдещ адаптер иска да импортира друг адаптер] → тестът пада с ясно
  съобщение; решението е или порт, или съзнателно разширяване на таблицата в
  STORY-1.6 с ред в design-а му.

## Migration Plan

Няма — само нови тестове. Ако тестът намери нарушение в днешния `src/`
(не се очаква: `grep -rn 'from "' src` показва само `./`, `../domain`,
`./ports`), то се поправя като отделна задача.

## Open Questions

(няма)
