// Driving (inbound) adapter tests (STORY-1.7).
//
// Two protocols - HTTP and a terminal - in front of the same inbound port.
// The story's claim is that the use case does not know which one called it,
// so neither adapter is tested with the real service: both get a *fake* use
// case, an object literal typed as `CalculateHouseholdFees`. That the fake
// compiles is the test of the acceptance criterion "the adapters receive the
// port, not the service"; everything else here is protocol: routes, status
// codes, body formats, exit codes.
//
// One `describe` per capability spec under openspec/specs/, one `test` per
// scenario. The HTTP tests run against a real server on an ephemeral port
// and talk to it with the global `fetch`.
import { after, before, describe, mock, test } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";

import type { CalculateHouseholdFees, CalculateHouseholdFeesCommand } from "../src/application/ports/in/CalculateHouseholdFees.ts";
import type { FeeReport } from "../src/domain/FeeReport.ts";
import { createBillingPeriod } from "../src/domain/BillingPeriod.ts";
import { buildFeeReport } from "../src/domain/FeeReport.ts";
import {
  FeeScheduleNotFound,
  HouseholdNotFound,
  InvalidBillingPeriod,
  InvalidFeeSchedule,
} from "../src/domain/errors.ts";
import { createHttpServer } from "../src/adapters/in/createHttpServer.ts";
import { runCli, type CliOutput } from "../src/adapters/in/runCli.ts";

// --- fixture -----------------------------------------------------------------
// The report hh-1 gets for Q1 2026 - the same three lines the service produces
// in calculate-fees.test.ts, assembled directly with buildFeeReport. The
// service is deliberately absent from this file.
const q1 = createBillingPeriod("2026-01-01", "2026-03-31");
const report: FeeReport = buildFeeReport("hh-1", q1, [
  { accountId: "acc-1", accountName: "Alpha", aum: 2_500_000, feeScheduleId: "standard", fee: 5239.73 },
  { accountId: "acc-2", accountName: "Beta", aum: 150_000, feeScheduleId: "standard", fee: 616.44 },
  { accountId: "acc-3", accountName: "Gamma", aum: 4_000_000, feeScheduleId: "premium", fee: 8383.56 },
]);
assert.equal(report.total, 14239.73); // guard the fixture itself

const q1Command: CalculateHouseholdFeesCommand = { householdId: "hh-1", from: "2026-01-01", to: "2026-03-31" };

// --- fake use case -----------------------------------------------------------
// `outcome` is swapped per test: a report to resolve with, or an error to
// reject with. `calls` records every command the adapter handed over. Typing
// `useCase` as the port (and nothing more) is the point of the story.
function fakeUseCase() {
  const calls: CalculateHouseholdFeesCommand[] = [];
  let outcome: FeeReport | Error = report;
  const useCase: CalculateHouseholdFees = {
    execute: async (command) => {
      calls.push(command);
      if (outcome instanceof Error) throw outcome;
      return outcome;
    },
  };
  return {
    useCase,
    calls,
    /** Reset the recorded calls and set what the next executions do. */
    arm(next: FeeReport | Error = report) {
      calls.length = 0;
      outcome = next;
    },
  };
}

// --- HTTP ----------------------------------------------------------------------
describe("http-adapter", () => {
  const fake = fakeUseCase();
  const server = createHttpServer(fake.useCase);
  let base = "";

  before(async () => {
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const { port } = server.address() as AddressInfo;
    base = `http://127.0.0.1:${port}`;
  });
  after(() => new Promise<void>((resolve) => server.close(() => resolve())));

  /** POST with a raw string body (so malformed JSON can be sent too). */
  const post = (path: string, body: string) =>
    fetch(base + path, { method: "POST", headers: { "content-type": "application/json" }, body });
  const validBody = JSON.stringify({ from: "2026-01-01", to: "2026-03-31" });
  const json = async (response: Response) => (await response.json()) as { error?: string; message?: string };

  test("a freshly created server is not listening until the caller says so", () => {
    const idle = createHttpServer(fake.useCase);
    assert.equal(idle.listening, false);
  });

  test("POST /households/hh-1/fees calls the use case once with householdId hh-1", async () => {
    fake.arm();
    const response = await post("/households/hh-1/fees", validBody);
    assert.equal(response.status, 200);
    assert.equal(fake.calls.length, 1);
    assert.equal(fake.calls[0]!.householdId, "hh-1");
  });

  test("GET on the route is 404 NOT_FOUND and never reaches the use case", async () => {
    fake.arm();
    const response = await fetch(`${base}/households/hh-1/fees`);
    assert.equal(response.status, 404);
    assert.equal((await json(response)).error, "NOT_FOUND");
    assert.equal(fake.calls.length, 0);
  });

  test("any other path is 404 NOT_FOUND", async () => {
    fake.arm();
    for (const path of ["/households/hh-1", "/fees", "/households//fees", "/nope"]) {
      const response = await post(path, validBody);
      assert.equal(response.status, 404, path);
      assert.equal((await json(response)).error, "NOT_FOUND", path);
    }
    assert.equal(fake.calls.length, 0);
  });

  test("the household id is URL-decoded before it reaches the use case", async () => {
    fake.arm();
    await post("/households/hh%201/fees", validBody);
    assert.equal(fake.calls[0]!.householdId, "hh 1");
  });

  test("a valid body reaches the use case as the exact command", async () => {
    fake.arm();
    await post("/households/hh-1/fees", validBody);
    assert.deepEqual(fake.calls, [q1Command]);
  });

  test("malformed JSON is 400 BAD_REQUEST and never reaches the use case", async () => {
    fake.arm();
    const response = await post("/households/hh-1/fees", "{ not json");
    assert.equal(response.status, 400);
    assert.equal((await json(response)).error, "BAD_REQUEST");
    assert.equal(fake.calls.length, 0);
  });

  test("a missing field is 400 and the message names it", async () => {
    fake.arm();
    const response = await post("/households/hh-1/fees", JSON.stringify({ from: "2026-01-01" }));
    assert.equal(response.status, 400);
    const body = await json(response);
    assert.equal(body.error, "BAD_REQUEST");
    assert.match(body.message ?? "", /\bto\b/);
    assert.equal(fake.calls.length, 0);
  });

  test("a field of the wrong type, or a body that is not an object, is 400", async () => {
    fake.arm();
    for (const body of [JSON.stringify({ from: "2026-01-01", to: 20260331 }), JSON.stringify(["2026-01-01", "2026-03-31"]), "null"]) {
      const response = await post("/households/hh-1/fees", body);
      assert.equal(response.status, 400, body);
      assert.equal((await json(response)).error, "BAD_REQUEST", body);
    }
    assert.equal(fake.calls.length, 0);
  });

  test("dates are not validated by the adapter - the string goes through untouched", async () => {
    fake.arm();
    await post("/households/hh-1/fees", JSON.stringify({ from: "not-a-date", to: "2026-03-31" }));
    assert.equal(fake.calls[0]!.from, "not-a-date");
  });

  test("success is 200 with the report as JSON", async () => {
    fake.arm();
    const response = await post("/households/hh-1/fees", validBody);
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") ?? "", /^application\/json/);
    const body = (await response.json()) as FeeReport;
    assert.deepEqual(body, report);
    assert.equal(body.total, 14239.73);
  });

  test("InvalidBillingPeriod is 400 with the error's code and message", async () => {
    fake.arm(new InvalidBillingPeriod('from must be YYYY-MM-DD, got "x"'));
    const response = await post("/households/hh-1/fees", validBody);
    assert.equal(response.status, 400);
    assert.deepEqual(await json(response), {
      error: "INVALID_BILLING_PERIOD",
      message: 'from must be YYYY-MM-DD, got "x"',
    });
  });

  test("HouseholdNotFound is 404 with the error's code and message", async () => {
    fake.arm(new HouseholdNotFound("hh-404"));
    const response = await post("/households/hh-404/fees", validBody);
    assert.equal(response.status, 404);
    assert.deepEqual(await json(response), { error: "HOUSEHOLD_NOT_FOUND", message: "Household not found: hh-404" });
  });

  test("FeeScheduleNotFound is 404", async () => {
    fake.arm(new FeeScheduleNotFound("vip"));
    const response = await post("/households/hh-1/fees", validBody);
    assert.equal(response.status, 404);
    assert.equal((await json(response)).error, "FEE_SCHEDULE_NOT_FOUND");
  });

  test("an unexpected error is 500 INTERNAL_ERROR and its message is not leaked", async () => {
    const quiet = mock.method(console, "error", () => {});
    try {
      fake.arm(new Error("disk on fire"));
      const response = await post("/households/hh-1/fees", validBody);
      assert.equal(response.status, 500);
      const body = await json(response);
      assert.equal(body.error, "INTERNAL_ERROR");
      assert.doesNotMatch(body.message ?? "", /disk on fire/);
      assert.equal(quiet.mock.callCount(), 1); // ...but it is logged on the server side
    } finally {
      quiet.mock.restore();
    }
  });

  test("InvalidFeeSchedule is a data problem, so 500 rather than 4xx", async () => {
    const quiet = mock.method(console, "error", () => {});
    try {
      fake.arm(new InvalidFeeSchedule("tiers must be ascending"));
      const response = await post("/households/hh-1/fees", validBody);
      assert.equal(response.status, 500);
      assert.equal((await json(response)).error, "INTERNAL_ERROR");
    } finally {
      quiet.mock.restore();
    }
  });

  test("a 404 is JSON too", async () => {
    const response = await fetch(`${base}/nope`);
    assert.match(response.headers.get("content-type") ?? "", /^application\/json/);
    const body = await json(response);
    assert.equal(typeof body.error, "string");
    assert.equal(typeof body.message, "string");
  });
});

// --- CLI -------------------------------------------------------------------------
describe("cli-adapter", () => {
  /** A sink that collects what is written; `text()` is everything so far. */
  function sink() {
    const chunks: string[] = [];
    return { write: (chunk: string) => chunks.push(chunk), text: () => chunks.join("") };
  }
  /** Fresh fake, fresh sinks, one run; returns everything a test could ask about. */
  async function run(argv: readonly string[], outcome: FeeReport | Error = report) {
    const fake = fakeUseCase();
    fake.arm(outcome);
    const stdout = sink();
    const stderr = sink();
    const out: CliOutput = { stdout, stderr };
    const code = await runCli(fake.useCase, argv, out);
    return { code, stdout: stdout.text(), stderr: stderr.text(), calls: fake.calls };
  }
  const usage = /usage.*<householdId> <from> <to> \[--json\]/;

  test("three positional arguments become the command and exit 0", async () => {
    const r = await run(["hh-1", "2026-01-01", "2026-03-31"]);
    assert.equal(r.code, 0);
    assert.deepEqual(r.calls, [q1Command]);
  });

  test("--json may come first", async () => {
    const r = await run(["--json", "hh-1", "2026-01-01", "2026-03-31"]);
    assert.equal(r.code, 0);
    assert.deepEqual(r.calls, [q1Command]);
    assert.doesNotThrow(() => JSON.parse(r.stdout));
  });

  test("too few arguments: usage on stderr, exit 2, use case not called", async () => {
    const r = await run(["hh-1", "2026-01-01"]);
    assert.equal(r.code, 2);
    assert.match(r.stderr, usage);
    assert.equal(r.stdout, "");
    assert.equal(r.calls.length, 0);
  });

  test("too many arguments: usage, exit 2", async () => {
    const r = await run(["hh-1", "2026-01-01", "2026-03-31", "extra"]);
    assert.equal(r.code, 2);
    assert.match(r.stderr, usage);
    assert.equal(r.calls.length, 0);
  });

  test("an unknown flag: usage, exit 2, use case not called", async () => {
    const r = await run(["hh-1", "2026-01-01", "2026-03-31", "--yaml"]);
    assert.equal(r.code, 2);
    assert.match(r.stderr, usage);
    assert.equal(r.calls.length, 0);
  });

  test("without --json: a header, one row per account, TOTAL last", async () => {
    const r = await run(["hh-1", "2026-01-01", "2026-03-31"]);
    assert.equal(r.code, 0);
    assert.equal(r.stderr, "");
    const lines = r.stdout.trimEnd().split("\n");
    assert.equal(lines.length, 5);
    assert.match(lines[0]!, /hh-1/);
    assert.match(lines[0]!, /2026-01-01\.\.2026-03-31/);
    assert.match(lines[1]!, /^acc-1\s+Alpha\s+2500000\s+standard\s+5239\.73$/);
    assert.match(lines[2]!, /^acc-2\s+Beta\s+150000\s+standard\s+616\.44$/);
    assert.match(lines[3]!, /^acc-3\s+Gamma\s+4000000\s+premium\s+8383\.56$/);
    assert.match(lines[4]!, /^TOTAL\s+14239\.73$/);
  });

  test("whole-number money is printed with two decimals", async () => {
    const whole = buildFeeReport("hh-9", q1, [
      { accountId: "acc-9", accountName: "Iota", aum: 900_000, feeScheduleId: "standard", fee: 9000 },
    ]);
    const r = await run(["hh-9", "2026-01-01", "2026-03-31"], whole);
    const lines = r.stdout.trimEnd().split("\n");
    assert.match(lines[1]!, /\s9000\.00$/);
    assert.match(lines[2]!, /^TOTAL\s+9000\.00$/);
  });

  test("--json: exactly one line, the report as JSON, exit 0", async () => {
    const r = await run(["hh-1", "2026-01-01", "2026-03-31", "--json"]);
    assert.equal(r.code, 0);
    assert.equal(r.stderr, "");
    assert.ok(r.stdout.endsWith("\n"));
    const lines = r.stdout.split("\n");
    assert.equal(lines.length, 2); // one line + the trailing newline
    const parsed = JSON.parse(lines[0]!) as FeeReport;
    assert.deepEqual(parsed, report);
    assert.equal(parsed.total, 14239.73);
  });

  test("--json is byte for byte the HTTP response body for the same report", async () => {
    const fake = fakeUseCase();
    const server = createHttpServer(fake.useCase);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    try {
      const { port } = server.address() as AddressInfo;
      const response = await fetch(`http://127.0.0.1:${port}/households/hh-1/fees`, {
        method: "POST",
        body: JSON.stringify({ from: "2026-01-01", to: "2026-03-31" }),
      });
      const httpBody = await response.text();
      const r = await run(["hh-1", "2026-01-01", "2026-03-31", "--json"]);
      assert.equal(r.stdout, httpBody + "\n");
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  test("a domain error: one line '<code>: <message>' on stderr, nothing on stdout, exit 1", async () => {
    const r = await run(["hh-404", "2026-01-01", "2026-03-31"], new HouseholdNotFound("hh-404"));
    assert.equal(r.code, 1);
    assert.equal(r.stderr, "HOUSEHOLD_NOT_FOUND: Household not found: hh-404\n");
    assert.equal(r.stdout, "");
  });

  test("a domain error in --json mode is still a text line on stderr, stdout stays empty", async () => {
    const r = await run(
      ["hh-1", "x", "2026-03-31", "--json"],
      new InvalidBillingPeriod('from must be YYYY-MM-DD, got "x"'),
    );
    assert.equal(r.code, 1);
    assert.ok(r.stderr.startsWith("INVALID_BILLING_PERIOD: "));
    assert.equal(r.stdout, "");
  });

  test("an error that is not a domain error is not swallowed", async () => {
    await assert.rejects(run(["hh-1", "2026-01-01", "2026-03-31"], new Error("disk on fire")), /disk on fire/);
  });

  test("with sinks given the process streams are not touched", async () => {
    const stdout = mock.method(process.stdout, "write", () => true);
    const stderr = mock.method(process.stderr, "write", () => true);
    try {
      await run(["hh-1", "2026-01-01", "2026-03-31"]);
      await run(["hh-1", "2026-01-01"]);
      await run(["hh-1", "2026-01-01", "2026-03-31"], new HouseholdNotFound("hh-1"));
      assert.equal(stdout.mock.callCount(), 0);
      assert.equal(stderr.mock.callCount(), 0);
    } finally {
      stdout.mock.restore();
      stderr.mock.restore();
    }
  });

  test("dates are not validated by the adapter - the string goes through untouched", async () => {
    const r = await run(["hh-1", "not-a-date", "2026-03-31"]);
    assert.equal(r.calls[0]!.from, "not-a-date");
  });
});
