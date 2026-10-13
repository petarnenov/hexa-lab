# hexa-lab

A teaching-sized billing project: tiered fees on assets under management
(AUM), built as a hexagon (Ports & Adapters) in TypeScript on Node, with no
framework and no runtime dependencies. The point is not the fees; it is that
you can swap the storage, or the way you call it, without touching the
business logic - and that a test fails if you try to cheat.

## The hexagon

Every box below is a real path in `src/`. Arrows point in the direction of
imports: the outside depends on the inside, never the other way round.

```
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
         │ Console…Publisher  │   │                    │
         └────────────────────┘   └────────────────────┘
                      driven (out) adapters

  src/bootstrap/compose.ts - the composition root: the only file that
  sees every box above. STORAGE=memory|json decides which driven
  adapters go behind the outbound ports; the use case never knows.
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

### Switching storage

Three environment variables, all read in `src/bootstrap/`:

| variable | default | meaning |
| --- | --- | --- |
| `STORAGE` | `memory` | `memory` (seed data in `src/bootstrap/seed.ts`) or `json` (reads `data/*.json` on every call) |
| `DATA_DIR` | `<repo>/data/` | where the `json` storage looks for `accounts.json` and `fee-schedules.json` |
| `PORT` | `3000` | HTTP only |

```sh
STORAGE=json npm run cli -- hh-1 2026-01-01 2026-03-31 --json
STORAGE=json PORT=3001 npm run http
```

Nothing under `src/domain/`, `src/application/` or `src/adapters/in/`
changes between the two: `compose.ts` builds a different pair of
repositories behind the same two outbound ports, and the use case cannot
tell. Any other value (`STORAGE=sqlite`, say) stops the process before
anything listens, with the allowed values in the message. Edit
`data/accounts.json` and run again with `STORAGE=json` to see the json
adapter is really reading the file.

### Demo: same total, four ways

The total for household `hh-1` in Q1 2026 is `14239.73`, whichever door you
come in through and whichever storage is behind the ports.

```sh
npm run cli -- hh-1 2026-01-01 2026-03-31                        # memory, table
STORAGE=json npm run cli -- hh-1 2026-01-01 2026-03-31 --json    # json, JSON
npm run http &                                                    # memory on :3000
STORAGE=json PORT=3001 npm run http &                             # json on :3001
curl -s -X POST localhost:3000/households/hh-1/fees -d '{"from":"2026-01-01","to":"2026-03-31"}'
curl -s -X POST localhost:3001/households/hh-1/fees -d '{"from":"2026-01-01","to":"2026-03-31"}'
```

The two `curl` bodies and the `--json` line are identical; the table shows
the same three fees and the same `TOTAL`. The only visible difference is the
first line each process logs: `[bootstrap] STORAGE=memory` or
`[bootstrap] STORAGE=json`.

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

To hand the project over as a single file without `node_modules`:

```sh
npm run pack          # writes hexa.tar.gz, everything under a hexa/ prefix
tar -xzf hexa.tar.gz  # on the other side: cd hexa && npm install && npm test
```
