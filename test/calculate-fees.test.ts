// Use case tests (STORY-1.4, extended by STORY-1.5).
//
// The use case is the heart of the hexagon, and this file is the proof that
// the heart beats without any infrastructure: every dependency is a tiny
// in-memory fake handed in through the constructor. The fakes also count
// their calls, so the tests can pin down *how* the ports are used (one
// schedule lookup per id, publish exactly once, nothing published on error),
// not just what comes out.
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { FeeScheduleNotFound, HouseholdNotFound, InvalidBillingPeriod } from "../src/domain/errors.ts";
import type { Account } from "../src/domain/Account.ts";
import type { FeeSchedule } from "../src/domain/FeeSchedule.ts";
import type { FeeReport } from "../src/domain/FeeReport.ts";
import type { CalculateHouseholdFees } from "../src/application/ports/in/CalculateHouseholdFees.ts";
import type { AccountRepository } from "../src/application/ports/out/AccountRepository.ts";
import type { FeeScheduleRepository } from "../src/application/ports/out/FeeScheduleRepository.ts";
import type { FeeReportPublisher } from "../src/application/ports/out/FeeReportPublisher.ts";
import { CalculateHouseholdFeesService } from "../src/application/CalculateHouseholdFeesService.ts";

// --- fixture -----------------------------------------------------------------
// Same `standard` tariff as domain.test.ts. `premium` is a single open tier
// chosen so that hh-1 for Q1 2026 totals 14 239.73 - the number the whole
// project is built around (EPIC-1 acceptance criteria).
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

// hh-1, Q1 2026 (90 days):
//   acc-1  2.5M standard  21 250 x 90/365 = 5 239.73
//   acc-2  150k standard   2 500 (minimum) x 90/365 =   616.44
//   acc-3  4M   premium   34 000 x 90/365 = 8 383.56
//                                         ----------
//                                          14 239.73
const acc1: Account = { id: "acc-1", householdId: "hh-1", name: "Alpha", aum: 2_500_000, feeScheduleId: "standard" };
const acc2: Account = { id: "acc-2", householdId: "hh-1", name: "Beta", aum: 150_000, feeScheduleId: "standard" };
const acc3: Account = { id: "acc-3", householdId: "hh-1", name: "Gamma", aum: 4_000_000, feeScheduleId: "premium" };
const acc4: Account = { id: "acc-4", householdId: "hh-2", name: "Delta", aum: 800_000, feeScheduleId: "standard" };

const q1 = { householdId: "hh-1", from: "2026-01-01", to: "2026-03-31" };

// --- fakes with call counters -------------------------------------------------
// Each fake is the port's one method over an array, plus a `calls` log so a
// test can assert how many times (and with what) the use case asked.
function accountRepo(accounts: readonly Account[]) {
  const calls: string[] = [];
  const repo: AccountRepository = {
    findByHouseholdId: async (householdId) => {
      calls.push(householdId);
      return accounts.filter((a) => a.householdId === householdId);
    },
  };
  return { repo, calls };
}

function scheduleRepo(schedules: readonly FeeSchedule[]) {
  const calls: string[] = [];
  const repo: FeeScheduleRepository = {
    findById: async (id) => {
      calls.push(id);
      return schedules.find((s) => s.id === id);
    },
  };
  return { repo, calls };
}

function spyPublisher() {
  const published: FeeReport[] = [];
  const publisher: FeeReportPublisher = {
    publish: async (report) => {
      published.push(report);
    },
  };
  return { publisher, published };
}

/** Wires a service over the default fixture; callers override what they need. */
function setup(overrides: { accounts?: readonly Account[]; schedules?: readonly FeeSchedule[] } = {}) {
  const accounts = accountRepo(overrides.accounts ?? [acc1, acc2, acc3, acc4]);
  const schedules = scheduleRepo(overrides.schedules ?? [standard, premium]);
  const pub = spyPublisher();
  const service: CalculateHouseholdFees = new CalculateHouseholdFeesService(
    accounts.repo,
    schedules.repo,
    pub.publisher,
  );
  return { service, accounts, schedules, ...pub };
}

describe("calculate-household-fees", () => {
  test("the service implements the inbound port and returns a report for the household", async () => {
    const { service } = setup();
    const report = await service.execute(q1);
    assert.equal(report.householdId, "hh-1");
  });

  test("hh-1 for Q1 2026: three lines, one per account, total 14 239.73", async () => {
    const { service } = setup();
    const report = await service.execute(q1);
    assert.deepEqual(report.period, { from: "2026-01-01", to: "2026-03-31" });
    assert.deepEqual(report.lines, [
      { accountId: "acc-1", accountName: "Alpha", aum: 2_500_000, feeScheduleId: "standard", fee: 5239.73 },
      { accountId: "acc-2", accountName: "Beta", aum: 150_000, feeScheduleId: "standard", fee: 616.44 },
      { accountId: "acc-3", accountName: "Gamma", aum: 4_000_000, feeScheduleId: "premium", fee: 8383.56 },
    ]);
    assert.equal(report.total, 14239.73);
  });

  test("lines are sorted by accountId regardless of storage order", async () => {
    const { service } = setup({ accounts: [acc3, acc1, acc2] });
    const report = await service.execute(q1);
    assert.deepEqual(
      report.lines.map((l) => l.accountId),
      ["acc-1", "acc-2", "acc-3"],
    );
  });

  test("each fee schedule is looked up exactly once per id", async () => {
    const { service, schedules } = setup();
    await service.execute(q1);
    assert.deepEqual([...schedules.calls].sort(), ["premium", "standard"]);
  });

  test("the report is published exactly once and the same object is returned", async () => {
    const { service, published } = setup();
    const report = await service.execute(q1);
    assert.equal(published.length, 1);
    assert.equal(published[0], report); // identity, not just equality
  });

  // --- failures: every one of them rejects with a domain error and
  //     publishes nothing ------------------------------------------------------

  test("an unknown household rejects with HouseholdNotFound and publishes nothing", async () => {
    const { service, published } = setup();
    await assert.rejects(
      service.execute({ ...q1, householdId: "hh-404" }),
      (err) => err instanceof HouseholdNotFound && err.householdId === "hh-404",
    );
    assert.equal(published.length, 0);
  });

  test("an account with a missing fee schedule rejects with FeeScheduleNotFound and publishes nothing", async () => {
    const { service, published } = setup({ accounts: [acc1, { ...acc2, feeScheduleId: "vip" }] });
    await assert.rejects(
      service.execute(q1),
      (err) => err instanceof FeeScheduleNotFound && err.feeScheduleId === "vip",
    );
    assert.equal(published.length, 0);
  });

  test("an impossible date rejects with InvalidBillingPeriod before any repository is asked", async () => {
    const { service, accounts, schedules, published } = setup();
    await assert.rejects(service.execute({ ...q1, from: "2026-02-30" }), InvalidBillingPeriod);
    assert.deepEqual(accounts.calls, []);
    assert.deepEqual(schedules.calls, []);
    assert.equal(published.length, 0);
  });

  test("from after to rejects with InvalidBillingPeriod", async () => {
    const { service, published } = setup();
    await assert.rejects(
      service.execute({ ...q1, from: "2026-03-31", to: "2026-01-01" }),
      InvalidBillingPeriod,
    );
    assert.equal(published.length, 0);
  });

  test("a failing publisher makes execute reject with the same error", async () => {
    const boom = new Error("publisher down");
    const failing: FeeReportPublisher = { publish: async () => Promise.reject(boom) };
    const service = new CalculateHouseholdFeesService(
      accountRepo([acc1]).repo,
      scheduleRepo([standard]).repo,
      failing,
    );
    await assert.rejects(service.execute(q1), (err) => err === boom);
  });

  test("the use case source knows no adapters, environment or console", async () => {
    // Cheap guard until architecture.test.ts (STORY-1.5): the use case may
    // only see domain/ and its own ports. If this trips, the dependency
    // belongs behind a port, not inside the use case.
    const source = await readFile(
      new URL("../src/application/CalculateHouseholdFeesService.ts", import.meta.url),
      "utf8",
    );
    assert.doesNotMatch(source, /adapters\/|bootstrap\/|node:|process\.env|console\./);
  });
});
