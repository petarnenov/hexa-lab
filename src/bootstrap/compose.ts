// compose - the composition root.
//
// This is the one file in src/ that knows every concrete class: the service,
// every driven adapter, the seed. Everything else sees only ports. The
// dependency rule (test/architecture.test.ts) lets bootstrap import all four
// layers precisely so that nobody else has to.
//
// `composeApp` is a plain function from (env, stderr) to an inbound port.
// Both are parameters with process defaults, so the entry points call it bare
// - `composeApp()` - while a test hands in `{ STORAGE: "json" }` and a
// collecting fake stderr and never touches process.env or the real streams.

import { fileURLToPath } from "node:url";
import { join } from "node:path";

import type { CalculateHouseholdFees } from "../application/ports/in/CalculateHouseholdFees.ts";
import type { AccountRepository } from "../application/ports/out/AccountRepository.ts";
import type { FeeScheduleRepository } from "../application/ports/out/FeeScheduleRepository.ts";
import type { FeeReportPublisher } from "../application/ports/out/FeeReportPublisher.ts";
import { CalculateHouseholdFeesService } from "../application/CalculateHouseholdFeesService.ts";
import { ConsoleFeeReportPublisher, type LineSink } from "../adapters/out/ConsoleFeeReportPublisher.ts";
import { InMemoryAccountRepository } from "../adapters/out/InMemoryAccountRepository.ts";
import { InMemoryFeeScheduleRepository } from "../adapters/out/InMemoryFeeScheduleRepository.ts";
import { JsonFileAccountRepository } from "../adapters/out/JsonFileAccountRepository.ts";
import { JsonFileFeeScheduleRepository } from "../adapters/out/JsonFileFeeScheduleRepository.ts";
import { TextFileAccountRepository } from "../adapters/out/TextFileAccountRepository.ts";
import { TextFileFeeReportPublisher } from "../adapters/out/TextFileFeeReportPublisher.ts";
import { TextFileFeeScheduleRepository } from "../adapters/out/TextFileFeeScheduleRepository.ts";
import { seedAccounts, seedFeeSchedules } from "./seed.ts";

/**
 * What we read from the environment. Structurally the same as
 * `NodeJS.ProcessEnv`, spelled out so a test can pass a plain object literal
 * and so the three variables the project reads are listed in one place.
 */
export type Env = Readonly<Record<string, string | undefined>>;

/**
 * `<repo>/data/`, derived from this file's own location - never from
 * `process.cwd()`, so `npm run http` works from any directory. The trailing
 * slash makes `new URL` treat it as a directory; `fileURLToPath` because the
 * JSON repositories take a path, not a URL.
 */
const DEFAULT_DATA_DIR = fileURLToPath(new URL("../../data/", import.meta.url));

/**
 * The directory the json and txt storages read from: `DATA_DIR` when set and
 * non-empty, else the project's data/. A relative DATA_DIR is relative to the
 * process cwd, as any env path would be. Whether the directory exists is not
 * checked here - the JSON repositories fail with the full path in the message
 * on first read (STORY-1.6), and a second check would be a second truth.
 * Exported for the test that proves cwd does not matter; the entry points do
 * not use it.
 */
export function dataDirFrom(env: Env): string {
  return env.DATA_DIR || DEFAULT_DATA_DIR;
}

type Repositories = { accounts: AccountRepository; schedules: FeeScheduleRepository };

const STORAGES = ["memory", "json", "txt"] as const;
const PUBLISHERS = ["console", "txt"] as const;

/**
 * The file `PUBLISHER=txt` appends reports to: `REPORT_FILE` when set and
 * non-empty, else `fee-reports.txt` in the data directory (git-ignored).
 * Exported for tests, like dataDirFrom.
 */
export function reportFileFrom(env: Env): string {
  return env.REPORT_FILE || join(dataDirFrom(env), "fee-reports.txt");
}

/**
* Builds the use case for the storage named by `env.STORAGE` and the
 * publisher named by `env.PUBLISHER`.
 *
 * The return type is the *port*, not `CalculateHouseholdFeesService`: the
 * entry points - and a future MCP adapter (EPIC-2) - get exactly what the
 * HTTP and CLI adapters ask for, and nothing they could reach past.
 *
 * `||` rather than `??` on purpose: `STORAGE=` in a shell is an empty string
 * and means "not set". Both values are validated before the log line and
 * before any adapter is built, synchronously: an unknown value produces one
 * error and nothing else. It is a plain Error, not a DomainError - a
 * misconfigured process is not a business fact, and the CLI adapter would
 * (rightly) refuse to translate it anyway.
 *
 * `LineSink` is reused from the console publisher: bootstrap may import
 * adapters/out, unlike adapters/in, which had to duplicate the type (1.7).
 * One sink carries both the bootstrap lines and the publisher's line, so a
 * test sees them together and `process.stdout` stays untouched. The
 * `PUBLISHER` line is written only for the non-default `txt`, so the default
 * log stays the single `STORAGE` line.
 */
export function composeApp(env: Env = process.env, stderr: LineSink = process.stderr): CalculateHouseholdFees {
  const storage = env.STORAGE || "memory";
  if (!isOneOf(STORAGES, storage)) {
    throw new Error(`STORAGE must be one of ${STORAGES.join(", ")} (got "${storage}")`);
  }
  const publisherName = env.PUBLISHER || "console";
  if (!isOneOf(PUBLISHERS, publisherName)) {
    throw new Error(`PUBLISHER must be one of ${PUBLISHERS.join(", ")} (got "${publisherName}")`);
  }
  stderr.write(`[bootstrap] STORAGE=${storage}\n`);

  let publisher: FeeReportPublisher = new ConsoleFeeReportPublisher(stderr);
  if (publisherName === "txt") {
    const reportFile = reportFileFrom(env);
    stderr.write(`[bootstrap] PUBLISHER=txt REPORT_FILE=${reportFile}\n`);
    publisher = new TextFileFeeReportPublisher(reportFile);
  }

  const { accounts, schedules } = repositoriesFor(storage, env);
  return new CalculateHouseholdFeesService(accounts, schedules, publisher);
}

function isOneOf<T extends string>(allowed: readonly T[], value: string): value is T {
  return (allowed as readonly string[]).includes(value);
}

function repositoriesFor(storage: (typeof STORAGES)[number], env: Env): Repositories {
  switch (storage) {
    case "memory":
      return memoryRepositories();
    case "json":
      return jsonRepositories(dataDirFrom(env));
    case "txt":
      return textRepositories(dataDirFrom(env));
  }
}

function memoryRepositories(): Repositories {
  return {
    accounts: new InMemoryAccountRepository(seedAccounts),
    schedules: new InMemoryFeeScheduleRepository(seedFeeSchedules),
  };
}

// The JSON repositories read lazily, on every call, so this is synchronous
// and a missing file surfaces at the first `execute`, not here.
function jsonRepositories(dir: string): Repositories {
  return {
    accounts: new JsonFileAccountRepository(join(dir, "accounts.json")),
    schedules: new JsonFileFeeScheduleRepository(join(dir, "fee-schedules.json")),
  };
}

// Same lazy reading as the JSON pair: a missing file surfaces at the first
// `execute`, with `<path>:<line>` for a malformed line.
function textRepositories(dir: string): Repositories {
  return {
    accounts: new TextFileAccountRepository(join(dir, "accounts.txt")),
    schedules: new TextFileFeeScheduleRepository(join(dir, "fee-schedules.txt")),
  };
}
