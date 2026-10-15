// Driven (outbound) adapter tests (STORY-1.6).
//
// Three technologies - memory, JSON files and plain text files on disk -
// behind the same three ports, plus the console and text file publishers. The story's claim is that the use case
// cannot tell them apart, so the heart of this file is a *contract* that runs
// unchanged against both repository pairs, and an end-to-end check that the
// service produces the identical report over either storage.
//
// One `describe` per capability spec under openspec/specs/, one `test` per
// scenario; the contract tests count for both repository specs.
import { after, describe, mock, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import type { Account } from "../src/domain/Account.ts";
import type { FeeSchedule } from "../src/domain/FeeSchedule.ts";
import type { FeeReport } from "../src/domain/FeeReport.ts";
import type { AccountRepository } from "../src/application/ports/out/AccountRepository.ts";
import type { FeeScheduleRepository } from "../src/application/ports/out/FeeScheduleRepository.ts";
import type { FeeReportPublisher } from "../src/application/ports/out/FeeReportPublisher.ts";
import { createBillingPeriod } from "../src/domain/BillingPeriod.ts";
import { buildFeeReport } from "../src/domain/FeeReport.ts";
import { ConsoleFeeReportPublisher } from "../src/adapters/out/ConsoleFeeReportPublisher.ts";
import { CalculateHouseholdFeesService } from "../src/application/CalculateHouseholdFeesService.ts";
import { InMemoryAccountRepository } from "../src/adapters/out/InMemoryAccountRepository.ts";
import { InMemoryFeeScheduleRepository } from "../src/adapters/out/InMemoryFeeScheduleRepository.ts";
import { JsonFileAccountRepository } from "../src/adapters/out/JsonFileAccountRepository.ts";
import { JsonFileFeeScheduleRepository } from "../src/adapters/out/JsonFileFeeScheduleRepository.ts";
import { TextFileAccountRepository } from "../src/adapters/out/TextFileAccountRepository.ts";
import { TextFileFeeScheduleRepository } from "../src/adapters/out/TextFileFeeScheduleRepository.ts";
import { TextFileFeeReportPublisher } from "../src/adapters/out/TextFileFeeReportPublisher.ts";

// --- fixture -----------------------------------------------------------------
// Verbatim the fixture of calculate-fees.test.ts, and verbatim the content of
// data/*.json: hh-1 for Q1 2026 totals 14 239.73 either way.
const standard: FeeSchedule = {
  id: "standard",
  name: "Standard",
  tiers: [
    { upTo: 1_000_000, annualRateBps: 100 },
    { upTo: 5_000_000, annualRateBps: 75 },
    { upTo: null, annualRateBps: 50 },
  ],
  minimumAnnualFee: 2_500,
};
const premium: FeeSchedule = {
  id: "premium",
  name: "Premium",
  tiers: [{ upTo: null, annualRateBps: 85 }],
  minimumAnnualFee: 5_000,
};
const acc1: Account = { id: "acc-1", householdId: "hh-1", name: "Alpha", aum: 2_500_000, feeScheduleId: "standard" };
const acc2: Account = { id: "acc-2", householdId: "hh-1", name: "Beta", aum: 150_000, feeScheduleId: "standard" };
const acc3: Account = { id: "acc-3", householdId: "hh-1", name: "Gamma", aum: 4_000_000, feeScheduleId: "premium" };
const acc4: Account = { id: "acc-4", householdId: "hh-2", name: "Delta", aum: 800_000, feeScheduleId: "standard" };

const ids = (accounts: readonly Account[]) => accounts.map((a) => a.id);

/** Absolute path to a file under data/ - independent of the process cwd. */
const dataFile = (name: string) => fileURLToPath(new URL(`../data/${name}`, import.meta.url));

const q1 = { householdId: "hh-1", from: "2026-01-01", to: "2026-03-31" };

/** A publisher that swallows reports; the use case needs one, these tests do not. */
const silentPublisher: FeeReportPublisher = { publish: async () => {} };

// --- the repository contract -------------------------------------------------
// What *every* pair of repositories must answer for the blueprint data,
// whatever the storage. Registered once per technology below. Ids are
// compared sorted because the contract does not care about storage order -
// each technology pins its own order in its own describe.
type RepositoryPair = { accounts: AccountRepository; schedules: FeeScheduleRepository };

function repositoryContract(name: string, make: () => RepositoryPair): void {
  describe(`${name} repositories honour the outbound ports`, () => {
    test("hh-1 has acc-1, acc-2 and acc-3", async () => {
      assert.deepEqual(ids(await make().accounts.findByHouseholdId("hh-1")).sort(), ["acc-1", "acc-2", "acc-3"]);
    });

    test("an unknown household yields an empty list, not an error", async () => {
      assert.deepEqual(await make().accounts.findByHouseholdId("hh-404"), []);
    });

    test("standard and premium come back with their tiers and minimums", async () => {
      const { schedules } = make();
      assert.deepEqual(await schedules.findById("standard"), standard);
      assert.deepEqual(await schedules.findById("premium"), premium);
    });

    test("a missing fee schedule yields undefined, not an error", async () => {
      assert.equal(await make().schedules.findById("vip"), undefined);
    });
  });
}

const memoryPair = (): RepositoryPair => ({
  accounts: new InMemoryAccountRepository([acc1, acc2, acc3, acc4]),
  schedules: new InMemoryFeeScheduleRepository([standard, premium]),
});
const jsonPair = (): RepositoryPair => ({
  accounts: new JsonFileAccountRepository(dataFile("accounts.json")),
  schedules: new JsonFileFeeScheduleRepository(dataFile("fee-schedules.json")),
});
const textPair = (): RepositoryPair => ({
  accounts: new TextFileAccountRepository(dataFile("accounts.txt")),
  schedules: new TextFileFeeScheduleRepository(dataFile("fee-schedules.txt")),
});

/** Scratch files under one temp directory, removed after the enclosing describe. */
function scratchDir() {
  let dir: string | undefined;
  after(async () => {
    if (dir !== undefined) await rm(dir, { recursive: true, force: true });
  });
  return {
    path: async (name: string) => join((dir ??= await mkdtemp(join(tmpdir(), "hexa-lab-"))), name),
    file: async function (name: string, content: string) {
      const path = await this.path(name);
      await writeFile(path, content, "utf8");
      return path;
    },
  };
}

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** Asserts the promise rejects with an Error whose message contains every part. */
const rejectsMentioning = (promise: Promise<unknown>, ...parts: (string | RegExp)[]) =>
  assert.rejects(promise, (err: unknown) => {
    assert.ok(err instanceof Error);
    for (const part of parts) assert.match(err.message, part instanceof RegExp ? part : new RegExp(escapeRegExp(part)));
    return true;
  });

// =============================================================================
describe("in-memory-repositories", () => {
  repositoryContract("in-memory", memoryPair);

  test("a household's accounts come back in the order they were given", async () => {
    const repo = new InMemoryAccountRepository([acc3, acc1, acc4, acc2]);
    assert.deepEqual(ids(await repo.findByHouseholdId("hh-1")), ["acc-3", "acc-1", "acc-2"]);
  });

  test("neither the input array nor a returned list can change the repository", async () => {
    const input = [acc3, acc1, acc4, acc2];
    const repo = new InMemoryAccountRepository(input);
    // The caller mutates what it got back...
    const first = (await repo.findByHouseholdId("hh-1")) as Account[];
    first.sort((a, b) => (a.id < b.id ? -1 : 1));
    first.length = 0;
    // ...and its own input array.
    input.length = 0;
    assert.deepEqual(ids(await repo.findByHouseholdId("hh-1")), ["acc-3", "acc-1", "acc-2"]);
  });

  test("with a duplicated id the last schedule given wins", async () => {
    const cheaper: FeeSchedule = { ...standard, minimumAnnualFee: 1 };
    const repo = new InMemoryFeeScheduleRepository([standard, cheaper]);
    assert.equal((await repo.findById("standard"))?.minimumAnnualFee, 1);
  });

  test("the use case runs over the in-memory pair without any change to it", async () => {
    const { accounts, schedules } = memoryPair();
    const service = new CalculateHouseholdFeesService(accounts, schedules, silentPublisher);
    const report: FeeReport = await service.execute(q1);
    assert.equal(report.lines.length, 3);
    assert.equal(report.total, 14239.73);
  });
});

// =============================================================================
describe("json-file-repositories", () => {
  repositoryContract("json-file", jsonPair);

  // Scratch directory for the "bad file" and "file changed" scenarios.
  let scratch: string;
  const scratchFile = async (name: string, content: string) => {
    scratch ??= await mkdtemp(join(tmpdir(), "hexa-lab-"));
    const path = join(scratch, name);
    await writeFile(path, content, "utf8");
    return path;
  };
  after(async () => {
    if (scratch !== undefined) await rm(scratch, { recursive: true, force: true });
  });

  test("hh-1 from data/accounts.json yields acc-1, acc-2, acc-3 in file order", async () => {
    const repo = new JsonFileAccountRepository(dataFile("accounts.json"));
    assert.deepEqual(ids(await repo.findByHouseholdId("hh-1")), ["acc-1", "acc-2", "acc-3"]);
  });

  test("data/accounts.json holds exactly the four blueprint accounts", async () => {
    const repo = new JsonFileAccountRepository(dataFile("accounts.json"));
    const all = [...(await repo.findByHouseholdId("hh-1")), ...(await repo.findByHouseholdId("hh-2"))];
    assert.deepEqual(all, [acc1, acc2, acc3, acc4]);
  });

  test("the file is read on every call, so a change shows up without a new instance", async () => {
    const one = { id: "acc-9", householdId: "hh-9", name: "Nine", aum: 1, feeScheduleId: "standard" };
    const path = await scratchFile("accounts.json", JSON.stringify([one]));
    const repo = new JsonFileAccountRepository(path);
    assert.equal((await repo.findByHouseholdId("hh-9")).length, 1);
    await writeFile(path, JSON.stringify([one, { ...one, id: "acc-10" }]), "utf8");
    assert.equal((await repo.findByHouseholdId("hh-9")).length, 2);
  });

  // --- a bad file is an error, never "no data" --------------------------------

  test("a missing file rejects with the path in the message", async () => {
    const path = join(tmpdir(), "hexa-lab-does-not-exist.json");
    await rejectsMentioning(new JsonFileAccountRepository(path).findByHouseholdId("hh-1"), path);
  });

  test("invalid JSON rejects with the path in the message", async () => {
    const path = await scratchFile("broken.json", "{ not json");
    await rejectsMentioning(new JsonFileAccountRepository(path).findByHouseholdId("hh-1"), path);
  });

  test("a wrongly typed field rejects naming the path and the field", async () => {
    const path = await scratchFile(
      "aum-string.json",
      JSON.stringify([{ id: "acc-1", householdId: "hh-1", name: "Alpha", aum: "2500000", feeScheduleId: "standard" }]),
    );
    await rejectsMentioning(new JsonFileAccountRepository(path).findByHouseholdId("hh-1"), path, "aum");
  });

  test("a wrapped object instead of an array rejects asking for an array", async () => {
    const path = await scratchFile("wrapped.json", JSON.stringify({ accounts: [] }));
    await rejectsMentioning(new JsonFileAccountRepository(path).findByHouseholdId("hh-1"), path, /array/i);
  });

  test("a schedule whose tiers are not an array rejects naming the path and tiers", async () => {
    const path = await scratchFile(
      "tiers-object.json",
      JSON.stringify([{ id: "standard", name: "Standard", tiers: {}, minimumAnnualFee: 2500 }]),
    );
    await rejectsMentioning(new JsonFileFeeScheduleRepository(path).findById("standard"), path, "tiers");
  });

  // --- the whole point of the story -------------------------------------------

  test("the use case gives the identical report over memory and over json", async () => {
    const overMemory = memoryPair();
    const overJson = jsonPair();
    const memoryReport = await new CalculateHouseholdFeesService(
      overMemory.accounts,
      overMemory.schedules,
      silentPublisher,
    ).execute(q1);
    const jsonReport = await new CalculateHouseholdFeesService(
      overJson.accounts,
      overJson.schedules,
      silentPublisher,
    ).execute(q1);
    assert.deepEqual(jsonReport, memoryReport);
    assert.equal(jsonReport.total, 14239.73);
  });
});

// =============================================================================
describe("text-file-repositories", () => {
  repositoryContract("text-file", textPair);
  const scratch = scratchDir();

  test("hh-1 from data/accounts.txt yields acc-1, acc-2, acc-3 in file order", async () => {
    const repo = new TextFileAccountRepository(dataFile("accounts.txt"));
    assert.deepEqual(ids(await repo.findByHouseholdId("hh-1")), ["acc-1", "acc-2", "acc-3"]);
  });

  test("data/accounts.txt holds exactly the four blueprint accounts", async () => {
    const repo = new TextFileAccountRepository(dataFile("accounts.txt"));
    const all = [...(await repo.findByHouseholdId("hh-1")), ...(await repo.findByHouseholdId("hh-2"))];
    assert.deepEqual(all, [acc1, acc2, acc3, acc4]);
  });

  test("blank lines, # comments and spaces around fields are ignored", async () => {
    const path = await scratch.file("accounts.txt", "\n# a comment\n  acc-9|hh-9|  Nine Nine |1.5|standard  \r\n\n");
    assert.deepEqual(await new TextFileAccountRepository(path).findByHouseholdId("hh-9"), [
      { id: "acc-9", householdId: "hh-9", name: "Nine Nine", aum: 1.5, feeScheduleId: "standard" },
    ]);
  });

  test("the file is read on every call, so a change shows up without a new instance", async () => {
    const line = "acc-9 | hh-9 | Nine | 1 | standard\n";
    const path = await scratch.file("changing.txt", line);
    const repo = new TextFileAccountRepository(path);
    assert.equal((await repo.findByHouseholdId("hh-9")).length, 1);
    await writeFile(path, line + line.replace("acc-9", "acc-10"), "utf8");
    assert.equal((await repo.findByHouseholdId("hh-9")).length, 2);
  });

  test("a missing file rejects with the path in the message", async () => {
    const path = join(tmpdir(), "hexa-lab-does-not-exist.txt");
    await rejectsMentioning(new TextFileAccountRepository(path).findByHouseholdId("hh-1"), path);
  });

  test("a line with the wrong number of fields rejects naming path:line", async () => {
    const path = await scratch.file("short.txt", "# header\nacc-1 | hh-1 | Alpha | 2500000\n");
    await rejectsMentioning(new TextFileAccountRepository(path).findByHouseholdId("hh-1"), `${path}:2`, "5 fields");
  });

  test("a non-numeric or empty aum rejects naming path:line and aum", async () => {
    for (const aum of ["lots", ""]) {
      const path = await scratch.file("aum.txt", `acc-1 | hh-1 | Alpha | ${aum} | standard\n`);
      await rejectsMentioning(new TextFileAccountRepository(path).findByHouseholdId("hh-1"), `${path}:1`, "aum");
    }
  });

  test("a schedule line with a malformed tier rejects naming path:line and the tier", async () => {
    const path = await scratch.file("tiers.txt", "standard | Standard | 2500 | 1000000-100\n");
    await rejectsMentioning(new TextFileFeeScheduleRepository(path).findById("standard"), `${path}:1`, "1000000-100");
  });

  test("a schedule with a non-numeric minimum or rate rejects naming the field", async () => {
    const minimum = await scratch.file("minimum.txt", "standard | Standard | x | *@50\n");
    await rejectsMentioning(new TextFileFeeScheduleRepository(minimum).findById("standard"), "minimumAnnualFee");
    const rate = await scratch.file("rate.txt", "standard | Standard | 2500 | *@fifty\n");
    await rejectsMentioning(new TextFileFeeScheduleRepository(rate).findById("standard"), "annualRateBps");
  });

  test("the use case gives the identical report over memory and over txt", async () => {
    const overMemory = memoryPair();
    const overText = textPair();
    const memoryReport = await new CalculateHouseholdFeesService(
      overMemory.accounts,
      overMemory.schedules,
      silentPublisher,
    ).execute(q1);
    const textReport = await new CalculateHouseholdFeesService(
      overText.accounts,
      overText.schedules,
      silentPublisher,
    ).execute(q1);
    assert.deepEqual(textReport, memoryReport);
    assert.equal(textReport.total, 14239.73);
  });
});

// =============================================================================
describe("text-file-report-publisher", () => {
  const scratch = scratchDir();
  const period = createBillingPeriod("2026-01-01", "2026-03-31");
  const report = buildFeeReport("hh-1", period, [
    { accountId: "acc-1", accountName: "Alpha", aum: 2_500_000, feeScheduleId: "standard", fee: 5239.73 },
    { accountId: "acc-2", accountName: "Beta", aum: 150_000, feeScheduleId: "standard", fee: 616.44 },
  ]);
  const expectedBlock =
    "household hh-1 | 2026-01-01..2026-03-31\n" +
    "acc-1 | Alpha | 2500000 | standard | 5239.73\n" +
    "acc-2 | Beta | 150000 | standard | 616.44\n" +
    "total | 5856.17\n" +
    "\n";

  test("a report becomes one block in the documented format, creating the file", async () => {
    const path = await scratch.path("created.txt");
    assert.equal(await new TextFileFeeReportPublisher(path).publish(report), undefined);
    assert.equal(await readFile(path, "utf8"), expectedBlock);
  });

  test("every publish appends; earlier content is kept", async () => {
    const path = await scratch.file("appended.txt", "earlier\n");
    const publisher = new TextFileFeeReportPublisher(path);
    await publisher.publish(report);
    await publisher.publish(report);
    assert.equal(await readFile(path, "utf8"), "earlier\n" + expectedBlock + expectedBlock);
  });

  test("an unwritable path rejects with the path in the message", async () => {
    const path = join(await scratch.path("no-such-dir"), "reports.txt");
    await rejectsMentioning(new TextFileFeeReportPublisher(path).publish(report), path);
  });

  test("the use case publishes the report it returns", async () => {
    const path = await scratch.path("use-case.txt");
    const { accounts, schedules } = memoryPair();
    const returned = await new CalculateHouseholdFeesService(accounts, schedules, new TextFileFeeReportPublisher(path)).execute(q1);
    const written = await readFile(path, "utf8");
    assert.ok(written.startsWith("household hh-1 | 2026-01-01..2026-03-31\n"), written);
    assert.ok(written.endsWith(`total | ${returned.total}\n\n`), written);
    assert.equal(written.split("\n").length, 2 + returned.lines.length + 2);
  });
});

// =============================================================================
describe("console-report-publisher", () => {
  const period = createBillingPeriod("2026-01-01", "2026-03-31");
  const line = (accountId: string, aum: number, feeScheduleId: string, fee: number) => ({
    accountId,
    accountName: accountId,
    aum,
    feeScheduleId,
    fee,
  });
  const threeLines = buildFeeReport("hh-1", period, [
    line("acc-1", 2_500_000, "standard", 5239.73),
    line("acc-2", 150_000, "standard", 616.44),
    line("acc-3", 4_000_000, "premium", 8383.56),
  ]);
  const oneLine = buildFeeReport("hh-1", period, [line("acc-1", 2_500_000, "standard", 5239.73)]);
  const expectedLine = "[publish] household hh-1 2026-01-01..2026-03-31 total=14239.73 (3 accounts)\n";

  /** A sink that just collects what is written; no stream machinery needed. */
  const collector = () => {
    const chunks: string[] = [];
    return { chunks, sink: { write: (chunk: string) => chunks.push(chunk) } };
  };

  test("a report becomes exactly one line in the documented format", async () => {
    const { chunks, sink } = collector();
    await new ConsoleFeeReportPublisher(sink).publish(threeLines);
    assert.deepEqual(chunks, [expectedLine]);
  });

  test("one line reads '1 account', not '1 accounts'", async () => {
    const { chunks, sink } = collector();
    await new ConsoleFeeReportPublisher(sink).publish(oneLine);
    assert.match(chunks[0]!, /total=5239\.73 \(1 account\)\n$/);
  });

  test("publish resolves with undefined", async () => {
    const { sink } = collector();
    assert.equal(await new ConsoleFeeReportPublisher(sink).publish(threeLines), undefined);
  });

  // --- stderr by default, stdout never ----------------------------------------
  // The mocks swallow writes (no call-through) and are restored right after
  // the assertions, so the test runner's own TAP output on stdout is unaffected.

  test("with no sink given the line goes to process.stderr and nothing to process.stdout", async () => {
    const stderrWrite = mock.method(process.stderr, "write", () => true);
    const stdoutWrite = mock.method(process.stdout, "write", () => true);
    try {
      await new ConsoleFeeReportPublisher().publish(threeLines);
      assert.equal(stderrWrite.mock.callCount(), 1);
      assert.equal(stderrWrite.mock.calls[0]!.arguments[0], expectedLine);
      assert.equal(stdoutWrite.mock.callCount(), 0);
    } finally {
      stderrWrite.mock.restore();
      stdoutWrite.mock.restore();
    }
  });

  test("with a sink given neither process stream is touched", async () => {
    const stderrWrite = mock.method(process.stderr, "write", () => true);
    const stdoutWrite = mock.method(process.stdout, "write", () => true);
    try {
      const { chunks, sink } = collector();
      await new ConsoleFeeReportPublisher(sink).publish(threeLines);
      assert.equal(chunks.length, 1);
      assert.equal(stderrWrite.mock.callCount(), 0);
      assert.equal(stdoutWrite.mock.callCount(), 0);
    } finally {
      stderrWrite.mock.restore();
      stdoutWrite.mock.restore();
    }
  });
});
