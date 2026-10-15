// Bootstrap tests (STORY-1.8).
//
// The composition root is the one place that knows every concrete class, so
// it is tested two ways: `composeApp` in-process with a fake stderr and an
// explicit env object (nothing here reads process.env), and the two entry
// points end-to-end as child processes, because a one-line main has nothing
// to unit test - either `npm run cli` prints the right total or it does not.
//
// One `describe` per capability spec under openspec/specs/, one `test` per
// scenario.
import { after, describe, mock, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join, sep } from "node:path";
import { execFile, spawn, type ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";

import type { CalculateHouseholdFeesCommand } from "../src/application/ports/in/CalculateHouseholdFees.ts";
import { HouseholdNotFound } from "../src/domain/errors.ts";
import { composeApp, dataDirFrom, reportFileFrom } from "../src/bootstrap/compose.ts";
import { TextFileAccountRepository } from "../src/adapters/out/TextFileAccountRepository.ts";
import { TextFileFeeScheduleRepository } from "../src/adapters/out/TextFileFeeScheduleRepository.ts";
import { seedAccounts, seedFeeSchedules } from "../src/bootstrap/seed.ts";

/** Parsed content of a file under data/ - independent of the process cwd. */
const readData = async (name: string): Promise<unknown> =>
  JSON.parse(await readFile(new URL(`../data/${name}`, import.meta.url), "utf8"));

const q1: CalculateHouseholdFeesCommand = { householdId: "hh-1", from: "2026-01-01", to: "2026-03-31" };

/** A collecting stderr: `lines` is every chunk written, in order. */
function sink() {
  const lines: string[] = [];
  return { lines, write: (chunk: string) => lines.push(chunk) };
}

const accountIds = (report: { lines: readonly { accountId: string }[] }) => report.lines.map((l) => l.accountId);

// =============================================================================
describe("composition-root", () => {
  describe("composeApp returns a ready inbound port", () => {
    test("an empty env yields a use case that computes hh-1 and publishes to the given stderr", async () => {
      const stderr = sink();
      const useCase = composeApp({}, stderr);
      assert.equal(typeof useCase.execute, "function");
      const report = await useCase.execute(q1);
      assert.deepEqual(accountIds(report), ["acc-1", "acc-2", "acc-3"]);
      assert.equal(report.total, 14239.73);
      assert.ok(stderr.lines.some((l) => l.startsWith("[publish] household hh-1 ")));
    });
  });

  describe("STORAGE selects the storage, memory by default", () => {
    test("a missing STORAGE is memory", async () => {
      const stderr = sink();
      const report = await composeApp({}, stderr).execute(q1);
      assert.equal(report.total, 14239.73);
      assert.deepEqual(stderr.lines.filter((l) => l.startsWith("[bootstrap]")), ["[bootstrap] STORAGE=memory\n"]);
    });

    test("STORAGE=memory and STORAGE='' are memory too", () => {
      for (const STORAGE of ["memory", ""]) {
        const stderr = sink();
        composeApp({ STORAGE }, stderr);
        assert.deepEqual(stderr.lines, ["[bootstrap] STORAGE=memory\n"]);
      }
    });

    test("STORAGE=json reads data/ and yields the identical report", async () => {
      const stderr = sink();
      const memory = await composeApp({}, sink()).execute(q1);
      const json = await composeApp({ STORAGE: "json" }, stderr).execute(q1);
      assert.deepEqual(json, memory);
      assert.equal(json.total, 14239.73);
      assert.deepEqual(stderr.lines.filter((l) => l.startsWith("[bootstrap]")), ["[bootstrap] STORAGE=json\n"]);
    });

    test("STORAGE=txt reads data/*.txt and yields the identical report", async () => {
      const stderr = sink();
      const memory = await composeApp({}, sink()).execute(q1);
      const txt = await composeApp({ STORAGE: "txt" }, stderr).execute(q1);
      assert.deepEqual(txt, memory);
      assert.deepEqual(stderr.lines.filter((l) => l.startsWith("[bootstrap]")), ["[bootstrap] STORAGE=txt\n"]);
    });

    test("an unknown STORAGE throws synchronously, naming the value and the allowed ones", () => {
      const stderr = sink();
      assert.throws(
        () => composeApp({ STORAGE: "sqlite" }, stderr),
        (error: unknown) => {
          assert.ok(error instanceof Error);
          assert.match(error.message, /STORAGE/);
          assert.match(error.message, /sqlite/);
          assert.match(error.message, /memory/);
          assert.match(error.message, /json/);
          assert.match(error.message, /txt/);
          return true;
        },
      );
      assert.deepEqual(stderr.lines, []); // no log line before the error
    });

    test("composing never touches process.stdout", async () => {
      const stdoutWrite = mock.method(process.stdout, "write", () => true);
      try {
        await composeApp({}, sink()).execute(q1);
        await composeApp({ STORAGE: "json" }, sink()).execute(q1);
        // The test runner's own reporter writes to stdout between awaits, so
        // count only chunks that could have come from bootstrap or the publisher.
        const ours = stdoutWrite.mock.calls.filter((c) => /\[(bootstrap|publish)\]/.test(String(c.arguments[0])));
        assert.deepEqual(ours, []);
      } finally {
        stdoutWrite.mock.restore();
      }
    });
  });

  describe("PUBLISHER selects the publisher, console by default", () => {
    test("PUBLISHER=txt appends to REPORT_FILE instead of the stderr line", async () => {
      const dir = await mkdtemp(join(tmpdir(), "hexa-lab-reports-"));
      after(() => rm(dir, { recursive: true, force: true }));
      const reportFile = join(dir, "reports.txt");
      const stderr = sink();
      const report = await composeApp({ PUBLISHER: "txt", REPORT_FILE: reportFile }, stderr).execute(q1);
      assert.deepEqual(stderr.lines, [
        "[bootstrap] STORAGE=memory\n",
        `[bootstrap] PUBLISHER=txt REPORT_FILE=${reportFile}\n`,
      ]);
      const written = await readFile(reportFile, "utf8");
      assert.ok(written.startsWith("household hh-1 | 2026-01-01..2026-03-31\n"), written);
      assert.ok(written.endsWith(`total | ${report.total}\n\n`), written);
    });

    test("PUBLISHER=console and PUBLISHER='' are the console line", async () => {
      for (const PUBLISHER of ["console", ""]) {
        const stderr = sink();
        await composeApp({ PUBLISHER }, stderr).execute(q1);
        assert.equal(stderr.lines.length, 2);
        assert.ok(stderr.lines[1]!.startsWith("[publish] household hh-1 "));
      }
    });

    test("REPORT_FILE defaults to fee-reports.txt in the data directory", () => {
      assert.equal(reportFileFrom({}), join(dataDirFrom({}), "fee-reports.txt"));
      assert.equal(reportFileFrom({ DATA_DIR: "/x" }), join("/x", "fee-reports.txt"));
      assert.equal(reportFileFrom({ DATA_DIR: "/x", REPORT_FILE: "/y/r.txt" }), "/y/r.txt");
    });

    test("an unknown PUBLISHER throws synchronously, naming the value and the allowed ones", () => {
      const stderr = sink();
      assert.throws(
        () => composeApp({ PUBLISHER: "email" }, stderr),
        (error: unknown) => {
          assert.ok(error instanceof Error);
          for (const word of ["PUBLISHER", "email", "console", "txt"]) assert.match(error.message, new RegExp(word));
          return true;
        },
      );
      assert.deepEqual(stderr.lines, []);
    });
  });

  describe("the data directory is the project's data/, DATA_DIR overrides it", () => {
    test("the default is absolute, derived from the module, and unaffected by cwd", async () => {
      const before = process.cwd();
      try {
        const fromHere = dataDirFrom({});
        process.chdir(tmpdir());
        const fromElsewhere = dataDirFrom({});
        assert.ok(isAbsolute(fromHere));
        assert.ok(fromHere.endsWith(`${sep}data${sep}`), fromHere);
        assert.equal(fromElsewhere, fromHere);
        const report = await composeApp({ STORAGE: "json" }, sink()).execute(q1);
        assert.equal(report.total, 14239.73);
      } finally {
        process.chdir(before);
      }
    });

    test("DATA_DIR wins when set and non-empty", () => {
      assert.equal(dataDirFrom({ DATA_DIR: "/x" }), "/x");
      assert.equal(dataDirFrom({ DATA_DIR: "" }), dataDirFrom({}));
    });

    test("DATA_DIR pointing at other data is what json mode reads", async () => {
      const dir = await mkdtemp(join(tmpdir(), "hexa-lab-"));
      after(() => rm(dir, { recursive: true, force: true }));
      await writeFile(
        join(dir, "accounts.json"),
        JSON.stringify([{ id: "acc-4", householdId: "hh-2", name: "Delta", aum: 800_000, feeScheduleId: "standard" }]),
      );
      await writeFile(join(dir, "fee-schedules.json"), JSON.stringify(await readData("fee-schedules.json")));

      const useCase = composeApp({ STORAGE: "json", DATA_DIR: dir }, sink());
      const hh2 = await useCase.execute({ householdId: "hh-2", from: "2026-01-01", to: "2026-03-31" });
      assert.deepEqual(accountIds(hh2), ["acc-4"]);
      await assert.rejects(useCase.execute(q1), HouseholdNotFound);
    });

    test("an empty DATA_DIR composes fine and fails at first execute, naming accounts.json", async () => {
      const dir = await mkdtemp(join(tmpdir(), "hexa-lab-empty-"));
      after(() => rm(dir, { recursive: true, force: true }));
      const useCase = composeApp({ STORAGE: "json", DATA_DIR: dir }, sink()); // does not throw
      await assert.rejects(useCase.execute(q1), (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.ok(error.message.includes(join(dir, "accounts.json")), error.message);
        return true;
      });
    });
  });

  describe("seed data mirrors data/*.json and data/*.txt", () => {
    // The seed is a deliberate duplicate of the JSON files (design.md D4);
    // this is the test that keeps the duplicate honest. deepEqual names the
    // first differing field, so an edit to one side fails with a pointer to
    // what to change on the other.
    test("seedAccounts equals data/accounts.json", async () => {
      assert.deepEqual(seedAccounts, await readData("accounts.json"));
    });

    test("seedFeeSchedules equals data/fee-schedules.json", async () => {
      assert.deepEqual(seedFeeSchedules, await readData("fee-schedules.json"));
    });

    // data/*.txt is a third copy; read through the txt adapters, since the
    // repositories have no "list all" - every household and every seed id.
    test("seedAccounts equals data/accounts.txt", async () => {
      const repo = new TextFileAccountRepository(fileURLToPath(new URL("../data/accounts.txt", import.meta.url)));
      const households = [...new Set(seedAccounts.map((a) => a.householdId))];
      const all = (await Promise.all(households.map((h) => repo.findByHouseholdId(h)))).flat();
      assert.deepEqual(all, seedAccounts);
    });

    test("seedFeeSchedules equals data/fee-schedules.txt", async () => {
      const repo = new TextFileFeeScheduleRepository(fileURLToPath(new URL("../data/fee-schedules.txt", import.meta.url)));
      assert.deepEqual(await Promise.all(seedFeeSchedules.map((s) => repo.findById(s.id))), seedFeeSchedules);
    });
  });
});

// =============================================================================
// The entry points are one-liners with process side effects, so they are
// tested the only honest way: as child processes running the real file with
// the real tsx loader, exactly as `npm run cli` / `npm run http` would.
const root = fileURLToPath(new URL("..", import.meta.url));
const CLI_MAIN = "src/bootstrap/cli.main.ts";
const HTTP_MAIN = "src/bootstrap/http.main.ts";
const Q1_ARGS = ["hh-1", "2026-01-01", "2026-03-31"];

/**
 * The child's environment: the parent's, minus the variables this
 * project reads, plus whatever the test sets. Without the minus, a developer
 * running `STORAGE=json npm test` would silently turn the memory scenarios
 * into json ones.
 */
function childEnv(overrides: Record<string, string> = {}): NodeJS.ProcessEnv {
  const { STORAGE: _s, DATA_DIR: _d, PORT: _p, PUBLISHER: _pb, REPORT_FILE: _r, ...rest } = process.env;
  return { ...rest, ...overrides };
}

type Run = { code: number; stdout: string; stderr: string };

/** Runs an entry point to completion. `cwd: root` so `--import tsx` resolves. */
function runMain(file: string, args: readonly string[], env: NodeJS.ProcessEnv): Promise<Run> {
  return new Promise((resolve, reject) => {
    execFile(
      process.execPath,
      ["--import", "tsx", file, ...args],
      { cwd: root, env, timeout: 10_000 },
      (error, stdout, stderr) => {
        if (error && typeof (error as { code?: unknown }).code !== "number") return reject(error); // spawn failure, not exit code
        resolve({ code: error ? (error as { code: number }).code : 0, stdout, stderr });
      },
    );
  });
}

type HttpChild = { child: ChildProcess; port: number; stdout: () => string; stderr: () => string };

/**
 * Starts http.main.ts and resolves once it logs the port it listens on.
 * Rejects (and kills the child) if that line does not appear within 5 s or
 * the process exits first.
 */
function spawnHttp(env: NodeJS.ProcessEnv): Promise<HttpChild> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["--import", "tsx", HTTP_MAIN], { cwd: root, env });
    let out = "";
    let err = "";
    const stdout = () => out;
    const stderr = () => err;
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`http.main.ts did not report a port within 5s; stderr:\n${err}`));
    }, 5_000);
    child.stdout.on("data", (chunk: Buffer) => (out += chunk.toString()));
    child.stderr.on("data", (chunk: Buffer) => {
      err += chunk.toString();
      const match = /\[bootstrap\] listening on http:\/\/localhost:(\d+)/.exec(err);
      if (match) {
        clearTimeout(timer);
        resolve({ child, port: Number(match[1]), stdout, stderr });
      }
    });
    child.on("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`http.main.ts exited with ${code} before listening; stderr:\n${err}`));
    });
    child.on("error", reject);
  });
}

/** Kills the child and waits for it to be gone, so no server outlives the test. */
function stop(child: ChildProcess): Promise<void> {
  return new Promise((resolve) => {
    if (child.exitCode !== null) return resolve();
    child.once("exit", () => resolve());
    child.kill();
  });
}

const postFees = (port: number) =>
  fetch(`http://localhost:${port}/households/hh-1/fees`, {
    method: "POST",
    body: JSON.stringify({ from: "2026-01-01", to: "2026-03-31" }),
    signal: AbortSignal.timeout(5_000),
  });

describe("entry-points", () => {
  describe("cli.main.ts hands argv to the CLI adapter and exits with its code", () => {
    test("memory: --json prints the hh-1 report, total 14239.73, logs on stderr only", async () => {
      const { code, stdout, stderr } = await runMain(CLI_MAIN, [...Q1_ARGS, "--json"], childEnv());
      assert.equal(code, 0, stderr);
      assert.equal(stdout.split("\n").length, 2); // one line plus the trailing newline
      assert.equal((JSON.parse(stdout) as { total: number }).total, 14239.73);
      assert.match(stderr, /^\[bootstrap\] STORAGE=memory$/m);
      assert.match(stderr, /^\[publish\] household hh-1 /m);
    });

    test("json: byte for byte the same stdout, STORAGE=json in the log", async () => {
      const memory = await runMain(CLI_MAIN, [...Q1_ARGS, "--json"], childEnv());
      const json = await runMain(CLI_MAIN, [...Q1_ARGS, "--json"], childEnv({ STORAGE: "json" }));
      assert.equal(json.code, 0, json.stderr);
      assert.equal(json.stdout, memory.stdout);
      assert.match(json.stderr, /^\[bootstrap\] STORAGE=json$/m);
    });

    test("txt: byte for byte the same stdout, STORAGE=txt in the log", async () => {
      const memory = await runMain(CLI_MAIN, [...Q1_ARGS, "--json"], childEnv());
      const txt = await runMain(CLI_MAIN, [...Q1_ARGS, "--json"], childEnv({ STORAGE: "txt" }));
      assert.equal(txt.code, 0, txt.stderr);
      assert.equal(txt.stdout, memory.stdout);
      assert.match(txt.stderr, /^\[bootstrap\] STORAGE=txt$/m);
    });

    test("usage error exits 2", async () => {
      const { code, stdout, stderr } = await runMain(CLI_MAIN, ["hh-1"], childEnv());
      assert.equal(code, 2);
      assert.match(stderr, /usage:/);
      assert.equal(stdout, "");
    });

    test("domain error exits 1", async () => {
      const { code, stdout, stderr } = await runMain(CLI_MAIN, ["hh-404", "2026-01-01", "2026-03-31"], childEnv());
      assert.equal(code, 1);
      assert.match(stderr, /HOUSEHOLD_NOT_FOUND/);
      assert.equal(stdout, "");
    });
  });


  describe("http.main.ts listens on PORT and reports the real port", () => {
    test("PORT=0: an ephemeral port is logged and serves hh-1 with total 14239.73", async () => {
      const { child, port, stderr } = await spawnHttp(childEnv({ PORT: "0" }));
      try {
        assert.ok(port > 0);
        const res = await postFees(port);
        assert.equal(res.status, 200);
        assert.equal(((await res.json()) as { total: number }).total, 14239.73);
        assert.match(stderr(), /^\[bootstrap\] STORAGE=memory$/m);
        assert.equal(child.exitCode, null); // still alive, waiting for requests
      } finally {
        await stop(child);
      }
    });

    test("STORAGE=json: deepEqual body, STORAGE=json in the log", async () => {
      const memory = await spawnHttp(childEnv({ PORT: "0" }));
      const json = await spawnHttp(childEnv({ PORT: "0", STORAGE: "json" }));
      try {
        const [a, b] = await Promise.all([postFees(memory.port), postFees(json.port)]);
        assert.deepEqual(await b.json(), await a.json());
        assert.match(json.stderr(), /^\[bootstrap\] STORAGE=json$/m);
      } finally {
        await Promise.all([stop(memory.child), stop(json.child)]);
      }
    });

    test("nothing is written to stdout", async () => {
      const { child, port, stdout } = await spawnHttp(childEnv({ PORT: "0" }));
      try {
        await postFees(port);
        assert.equal(stdout(), "");
      } finally {
        await stop(child);
      }
    });
  });

  describe("invalid configuration stops the process with a clear message", () => {
    test("cli with STORAGE=sqlite", async () => {
      const { code, stdout, stderr } = await runMain(CLI_MAIN, Q1_ARGS, childEnv({ STORAGE: "sqlite" }));
      assert.notEqual(code, 0);
      assert.equal(stdout, "");
      for (const word of ["STORAGE", "sqlite", "memory", "json"]) assert.ok(stderr.includes(word), stderr);
    });

    test("http with STORAGE=sqlite exits non-zero without listening", async () => {
      const { code, stdout, stderr } = await runMain(HTTP_MAIN, [], childEnv({ PORT: "0", STORAGE: "sqlite" }));
      assert.notEqual(code, 0);
      assert.equal(stdout, "");
      assert.doesNotMatch(stderr, /listening/);
      for (const word of ["STORAGE", "sqlite"]) assert.ok(stderr.includes(word), stderr);
    });
  });
});
