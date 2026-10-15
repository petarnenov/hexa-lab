# hexa-lab

A teaching-sized billing project: tiered fees on assets under management
(AUM), built as a hexagon (Ports & Adapters) in TypeScript on Node, with no
framework and no runtime dependencies in the hexagon itself (the browser
client in `ui/` is a separate package). The point is not the fees; it is that
you can swap the storage, or the way you call it, without touching the
business logic - and that a test fails if you try to cheat.

## The hexagon

Every box below is a real path in the repo (all in `src/`, except `ui/`, which
is the browser client outside the hexagon). Arrows point in the direction of
imports: the outside depends on the inside, never the other way round.

```
                                   ┌──────────────────────┐
                                   │ ui/  (React + Vite)  │  separate npm
                                   │ src/api/calculateFees│  package, imports
                                   └──────────┬───────────┘  nothing from src/
                                              │ HTTP (Vite proxy
               terminal                 curl  │  /households → :3000)
                   │                      │   │        clients, outside
                   ▼                      ▼   ▼        the hexagon
                      driving (in) adapters
         ┌────────────────────┐   ┌────────────────────┐
         │ src/adapters/in/   │   │ src/adapters/in/   │
         │ runCli.ts          │   │ createHttpServer.ts│
         └─────────┬──────────┘   └──────────┬─────────┘
                   │  call the port           │
                   ▼                          ▼
       ╭──────────────────────────────────────────────────╮
       │ inbound port   src/application/ports/in/         │
       │                CalculateHouseholdFees.ts         │
       │  ┌────────────────────────────────────────────┐  │
       │  │ use case  src/application/                 │  │
       │  │           CalculateHouseholdFeesService.ts │  │
       │  │   ┌────────────────────────────────────┐   │  │
       │  │   │ domain  src/domain/                │   │  │
       │  │   │  tieredFee · BillingPeriod ·       │   │  │
       │  │   │  FeeReport · errors                │   │  │
       │  │   └────────────────────────────────────┘   │  │
       │  └────────────────────────────────────────────┘  │
       │ outbound ports  src/application/ports/out/       │
       │   AccountRepository · FeeScheduleRepository ·    │
       │   FeeReportPublisher                             │
       ╰──────────────────────────────────────────────────╯
                   ▲                          ▲
                   │  implement the ports     │
         ┌─────────┴──────────┐   ┌──────────┴─────────┐
         │ src/adapters/out/  │   │ src/adapters/out/  │
         │ InMemory*.ts       │   │ JsonFile*.ts       │
         │ Console…Publisher  │   │ TextFile*.ts       │
         └────────────────────┘   └────────────────────┘
                      driven (out) adapters

  src/bootstrap/compose.ts - the composition root: the only file that
  sees every box above. STORAGE=memory|json|txt and PUBLISHER=console|txt
  decide which driven adapters go behind the outbound ports; the use case
  never knows.
```

| layer | folder | may import |
| --- | --- | --- |
| domain | `src/domain/` | `domain/` only - no I/O, no `node:*` |
| application | `src/application/` | `domain/`, `application/` (use case + ports) |
| driving adapters | `src/adapters/in/` | `domain/`, `application/`, `node:*` - never `adapters/out/` |
| driven adapters | `src/adapters/out/` | `domain/`, `application/`, `node:*` - never `adapters/in/` |
| bootstrap | `src/bootstrap/` | everything |

This table is also data in `test/architecture.test.ts`: the test parses every
import in `src/`, maps source and target to a layer, and fails `npm test` with
the file, the import and the broken rule if any edge is not in the table.
Exercise 5 below is to watch it fire.

`ui/` is not a row in that table. It is a separate npm package outside
`src/` - a browser client that talks to the HTTP adapter over HTTP only,
imports nothing from `src/`, and is not walked by the architecture test.
Like `curl`, it sits outside the hexagon and knocks on a door.

## Running it

Node 22 or newer. Everything runs straight from TypeScript through `tsx`.

### Install and test

```sh
npm install
npm test            # node:test, every test/*.test.ts
npm run typecheck   # tsc --noEmit, strict
```

### CLI

```sh
npm run cli -- hh-1 2026-01-01 2026-03-31
```

```
[bootstrap] STORAGE=memory
[publish] household hh-1 2026-01-01..2026-03-31 total=14239.73 (3 accounts)
Household hh-1  2026-01-01..2026-03-31
acc-1  Alpha  2500000  standard   5239.73
acc-2  Beta    150000  standard    616.44
acc-3  Gamma  4000000  premium    8383.56
TOTAL                            14239.73
```

The two `[...]` lines are on stderr (the bootstrap log and the console
publisher, a driven adapter); the table is stdout. Add `--json` and stdout
becomes the report as one line of JSON - byte for byte what the HTTP
adapter sends:

```sh
npm run cli -- hh-1 2026-01-01 2026-03-31 --json
```

```
{"householdId":"hh-1","period":{"from":"2026-01-01","to":"2026-03-31"},"lines":[{"accountId":"acc-1","accountName":"Alpha","aum":2500000,"feeScheduleId":"standard","fee":5239.73},{"accountId":"acc-2","accountName":"Beta","aum":150000,"feeScheduleId":"standard","fee":616.44},{"accountId":"acc-3","accountName":"Gamma","aum":4000000,"feeScheduleId":"premium","fee":8383.56}],"total":14239.73}
```

Exit codes: `0` success, `1` the request failed (a domain error, printed as
`CODE: message` on stderr), `2` bad usage.

```sh
npm run cli -- hh-404 2026-01-01 2026-03-31
# [bootstrap] STORAGE=memory
# HOUSEHOLD_NOT_FOUND: Household not found: hh-404
# (exit code 1)
```

### HTTP

```sh
npm run http
# [bootstrap] STORAGE=memory
# [bootstrap] listening on http://localhost:3000
```

One route: `POST /households/:id/fees` with a JSON body `{ "from", "to" }`.

```sh
curl -s -X POST localhost:3000/households/hh-1/fees \
  -H 'content-type: application/json' \
  -d '{"from":"2026-01-01","to":"2026-03-31"}'
```

```
{"householdId":"hh-1","period":{"from":"2026-01-01","to":"2026-03-31"},"lines":[{"accountId":"acc-1","accountName":"Alpha","aum":2500000,"feeScheduleId":"standard","fee":5239.73},{"accountId":"acc-2","accountName":"Beta","aum":150000,"feeScheduleId":"standard","fee":616.44},{"accountId":"acc-3","accountName":"Gamma","aum":4000000,"feeScheduleId":"premium","fee":8383.56}],"total":14239.73}
```

Errors are JSON too, with the same codes the CLI prints:

```sh
curl -s -i -X POST localhost:3000/households/hh-404/fees \
  -H 'content-type: application/json' \
  -d '{"from":"2026-01-01","to":"2026-03-31"}'
```

```
HTTP/1.1 404 Not Found
content-type: application/json; charset=utf-8

{"error":"HOUSEHOLD_NOT_FOUND","message":"Household not found: hh-404"}
```

`InvalidBillingPeriod` and a malformed body are `400`; anything unexpected
is `500` with a generic body and the real error on the server log. The
translation from domain error to status code happens in exactly one place,
`src/adapters/in/createHttpServer.ts` - the use case throws the same error
whoever is calling.

### UI

A small React page (`ui/`) over the same HTTP adapter: one form, one
table. It is its own npm package with its own `package.json` and lockfile,
so install it once, separately from the root:

```sh
cd ui && npm install
```

Then two terminals, both from the repo root:

```sh
npm run http   # terminal 1: the HTTP adapter on :3000
npm run ui     # terminal 2: Vite dev server on http://localhost:5173
```

Open `http://localhost:5173`. The form comes filled in with `hh-1` and
Q1 2026; **Calculate** shows the three lines and `14,239.73` - the same
report as the `curl` above, formatted. `hh-404` shows the error code and
message in a panel instead of a table.

The page calls `/households/...` on its own origin and the Vite dev server
proxies that path to `http://localhost:3000`. That proxy is the whole
integration: `src/adapters/in/createHttpServer.ts` has no CORS header and
does not know the UI exists. `PORT` is read by both sides, once at startup,
so to use another backend port pass it to both: `PORT=3001 npm run http`
and `PORT=3001 npm run ui`. To move Vite itself off 5173:

```sh
npm run ui -- -- --port 5174        # two "--": one for the root npm, one for the nested one
cd ui && npm run dev -- --port 5174 # the same, from inside ui/
```

(`npm run ui -- --port 5174` does *not* work: the nested `npm` swallows
`--port` as its own option. Vite prints the address it actually bound.)

Tests and types for the UI, from the root or from `ui/`:

```sh
npm run ui:test                     # = cd ui && npm test (Vitest, jsdom)
cd ui && npm run typecheck
```

`ui/` imports nothing from `src/`; it knows only the JSON contract of the
HTTP adapter (a copy of the report type lives in `ui/src/api/types.ts`).
The root `npm test` and `test/architecture.test.ts` never look at it.

### Switching storage

Five environment variables, all read in `src/bootstrap/`:

| variable | default | meaning |
| --- | --- | --- |
| `STORAGE` | `memory` | `memory` (seed data in `src/bootstrap/seed.ts`), `json` (reads `data/*.json` on every call) or `txt` (reads `data/*.txt` on every call) |
| `DATA_DIR` | `<repo>/data/` | where the `json` / `txt` storage looks for `accounts.*` and `fee-schedules.*` |
| `PUBLISHER` | `console` | `console` (one `[publish]` line on stderr) or `txt` (appends each report to `REPORT_FILE`) |
| `REPORT_FILE` | `<DATA_DIR>/fee-reports.txt` | where `PUBLISHER=txt` appends; the default is git-ignored |
| `PORT` | `3000` | HTTP only |

```sh
STORAGE=json npm run cli -- hh-1 2026-01-01 2026-03-31 --json
STORAGE=json PORT=3001 npm run http
```

Nothing under `src/domain/`, `src/application/` or `src/adapters/in/`
changes between them: `compose.ts` builds a different pair of
repositories behind the same two outbound ports, and the use case cannot
tell. Any other value (`STORAGE=sqlite`, say) stops the process before
anything listens, with the allowed values in the message. Edit
`data/accounts.json` and run again with `STORAGE=json` to see the json
adapter is really reading the file.

### Plain text files

`STORAGE=txt` reads the same data from two text files you can edit in any
editor - one record per line, fields separated by `|`, blank lines and `#`
comments ignored:

```
# data/accounts.txt
acc-1 | hh-1 | Alpha | 2500000 | standard

# data/fee-schedules.txt - tiers are upTo@annualRateBps, * = no upper bound
standard | Standard | 2500 | 1000000@100, 5000000@75, *@50
```

A malformed line stops the request with `<file>:<line>` in the message.
`PUBLISHER=txt` swaps the third port's adapter: instead of the `[publish]`
line on stderr, every report is appended to `REPORT_FILE` as one block.

```sh
STORAGE=txt PUBLISHER=txt npm run cli -- hh-1 2026-01-01 2026-03-31
cat data/fee-reports.txt
```

```
household hh-1 | 2026-01-01..2026-03-31
acc-1 | Alpha | 2500000 | standard | 5239.73
acc-2 | Beta | 150000 | standard | 616.44
acc-3 | Gamma | 4000000 | premium | 8383.56
total | 14239.73
```

### Demo: same total, five ways

The total for household `hh-1` in Q1 2026 is `14239.73`, whichever door you
come in through and whichever storage is behind the ports.

```sh
npm run cli -- hh-1 2026-01-01 2026-03-31                        # memory, table
STORAGE=json npm run cli -- hh-1 2026-01-01 2026-03-31 --json    # json, JSON
npm run http &                                                    # memory on :3000
STORAGE=json PORT=3001 npm run http &                             # json on :3001
curl -s -X POST localhost:3000/households/hh-1/fees -d '{"from":"2026-01-01","to":"2026-03-31"}'
curl -s -X POST localhost:3001/households/hh-1/fees -d '{"from":"2026-01-01","to":"2026-03-31"}'
npm run ui                                                        # 5. the browser, on :3000
```

The two `curl` bodies and the `--json` line are identical; the table shows
the same three fees and the same `TOTAL`. The only visible difference is the
first line each process logs: `[bootstrap] STORAGE=memory` or
`[bootstrap] STORAGE=json`. The fifth way is the browser: open
`http://localhost:5173`, press **Calculate**, and the table shows the same
three fees and `14,239.73` (the UI adds the thousands separator; the number
is the one the `:3000` server just sent - and logged on stderr).

## Exercises

Each exercise is a story under `backlog/EPIC-2-exercises/`, with its tasks
broken down there. They are not implemented here - that is the point.

1. **A SQLite adapter for `AccountRepository`.** A third driven adapter, so
   you can see the port does not change: `STORAGE=sqlite` should work with
   no edit in `src/domain/` or `src/application/`. Hint: `node:sqlite`
   (Node 22.5+) needs no dependency; write one contract test and run it
   against InMemory, JsonFile and SQLite.
   → [STORY-2.1](backlog/EPIC-2-exercises/STORY-2.1-sqlite-adapter/STORY-2.1.md)

2. **An MCP tool as a driving adapter.** A third way in, next to CLI and
   HTTP: a tool `calculate_household_fees` that returns the same report.
   Hint: the tool schema is `householdId`, `from`, `to` - the inbound port's
   command; the adapter takes the port, exactly like `runCli` does, and a
   new `mcp.main.ts` in `src/bootstrap/` composes it.
   → [STORY-2.2](backlog/EPIC-2-exercises/STORY-2.2-mcp-adapter/STORY-2.2.md)

3. **An outbound port `Clock`.** Time through a port, so tests are
   deterministic: the use case must not call `new Date()` itself. Hint: add
   `generatedAt` to the report, a `Clock` interface with `now(): Date` in
   `src/application/ports/out/`, a `SystemClock` for bootstrap and a
   `FixedClock` for tests.
   → [STORY-2.3](backlog/EPIC-2-exercises/STORY-2.3-clock-port/STORY-2.3.md)

4. **A use case "preview fees" without publish.** A second inbound port and
   service that compute the same report but never call the publisher, to
   see how little changes. Hint: reuse the domain functions as they are;
   expose it as `POST /households/:id/fees/preview` and a CLI flag.
   → [STORY-2.4](backlog/EPIC-2-exercises/STORY-2.4-preview-fees/STORY-2.4.md)

5. **Break the dependency rule.** Watch the architecture test fire. Hint:
   import something from `src/adapters/out/` into `src/domain/tieredFee.ts`,
   run `npm test`, read the message (file, import, broken rule), then
   remove the import.
   → [STORY-2.5](backlog/EPIC-2-exercises/STORY-2.5-break-the-rule/STORY-2.5.md)

## How this repo is worked on

- `backlog/` says *what*: epic → story → task → subtask, one Markdown file
  each, status in the frontmatter. Start at `backlog/README.md`.
- `openspec/` says *how*: one OpenSpec change per story (proposal, design,
  spec deltas, tasks), archived into `openspec/specs/` when the story is
  done. The specs are the behaviour contract the tests follow.
- `CLAUDE.md` is the working agreement between the two.

To hand the project over as a single file without `node_modules` (the
archive includes `ui/`, minus its `node_modules/` and `dist/`):

```sh
npm run pack          # writes hexa.tar.gz, everything under a hexa/ prefix
tar -xzf hexa.tar.gz  # on the other side:
cd hexa && npm install && npm test && (cd ui && npm install && npm test)
```
