// Port tests (STORY-1.3).
//
// Ports are pure TypeScript interfaces, so there is no behaviour to test in
// the usual sense. What we check instead are the two properties the story
// promises:
//   1. every port can be satisfied by a tiny fake - no base class, no helper,
//      just an object literal typed as the port (so `tsc` enforces the shape);
//   2. the port modules carry no runtime code - imported at run time they are
//      empty objects, so an adapter importing a port pays nothing for it.
// The fakes double as the first consumers of the ports; STORY-1.4 reuses them.
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { createBillingPeriod } from "../src/domain/BillingPeriod.ts";
import { buildFeeReport } from "../src/domain/FeeReport.ts";
import type { Account } from "../src/domain/Account.ts";
import type { FeeSchedule } from "../src/domain/FeeSchedule.ts";
import type { FeeReport } from "../src/domain/FeeReport.ts";
import type {
  CalculateHouseholdFees,
  CalculateHouseholdFeesCommand,
} from "../src/application/ports/in/CalculateHouseholdFees.ts";
import type { AccountRepository } from "../src/application/ports/out/AccountRepository.ts";
import type { FeeScheduleRepository } from "../src/application/ports/out/FeeScheduleRepository.ts";
import type { FeeReportPublisher } from "../src/application/ports/out/FeeReportPublisher.ts";

const q1 = createBillingPeriod("2026-01-01", "2026-03-31");
const report = buildFeeReport("hh-1", q1, [
  { accountId: "acc-1", accountName: "Alpha", aum: 2_500_000, feeScheduleId: "standard", fee: 5239.73 },
  { accountId: "acc-2", accountName: "Beta", aum: 1_000_000, feeScheduleId: "standard", fee: 9000 },
]);

/** Dynamic import of a port module: the only way to observe "no runtime exports". */
async function runtimeExportsOf(relativePath: string): Promise<string[]> {
  const mod: object = await import(relativePath);
  return Object.keys(mod);
}

describe("calculate-household-fees", () => {
  // The whole fake is one method; nothing else is needed to implement the port.
  const fake: CalculateHouseholdFees = { execute: async () => report };

  test("an adapter builds the command from raw strings", async () => {
    const command: CalculateHouseholdFeesCommand = {
      householdId: "hh-1",
      from: "2026-01-01",
      to: "2026-03-31",
    };
    const result = await fake.execute(command);
    assert.equal(result.householdId, "hh-1");
    assert.deepEqual(result.period, q1);
    assert.equal(result.lines.length, 2);
    assert.equal(result.total, 14239.73);
  });

  test("the inbound port module has no runtime exports", async () => {
    assert.deepEqual(await runtimeExportsOf("../src/application/ports/in/CalculateHouseholdFees.ts"), []);
  });
});

describe("outbound-ports", () => {
  const accounts: Account[] = [
    { id: "acc-1", householdId: "hh-1", name: "Alpha", aum: 2_500_000, feeScheduleId: "standard" },
    { id: "acc-2", householdId: "hh-1", name: "Beta", aum: 1_000_000, feeScheduleId: "standard" },
    { id: "acc-3", householdId: "hh-2", name: "Gamma", aum: 150_000, feeScheduleId: "standard" },
  ];
  const standard: FeeSchedule = {
    id: "standard",
    name: "Standard",
    tiers: [
      { upTo: 1_000_000, annualRateBps: 100 },
      { upTo: 5_000_000, annualRateBps: 75 },
      { upTo: null, annualRateBps: 50 },
    ],
    minimumAnnualFee: 2500,
  };

  // Each fake is a single method over an in-memory array - the smallest thing
  // that can satisfy the port. If a port grows a member, `tsc` fails here.
  const accountRepo: AccountRepository = {
    findByHouseholdId: async (householdId) => accounts.filter((a) => a.householdId === householdId),
  };
  const scheduleRepo: FeeScheduleRepository = {
    findById: async (id) => (id === standard.id ? standard : undefined),
  };
  const published: FeeReport[] = [];
  const publisher: FeeReportPublisher = {
    publish: async (r) => {
      published.push(r);
    },
  };

  test("a household with accounts yields exactly those accounts", async () => {
    const found = await accountRepo.findByHouseholdId("hh-1");
    assert.deepEqual(
      found.map((a) => a.id),
      ["acc-1", "acc-2"],
    );
  });

  test("an unknown household yields an empty list, not an error", async () => {
    assert.deepEqual(await accountRepo.findByHouseholdId("hh-404"), []);
  });

  test("an existing fee schedule is returned with its tiers and minimum", async () => {
    const found = await scheduleRepo.findById("standard");
    assert.deepEqual(found, standard);
  });

  test("a missing fee schedule yields undefined, not an error", async () => {
    assert.equal(await scheduleRepo.findById("vip"), undefined);
  });

  test("publishing hands over the report and resolves with nothing", async () => {
    const result = await publisher.publish(report);
    assert.equal(result, undefined);
    assert.deepEqual(published, [report]);
  });

  test("the outbound port modules have no runtime exports", async () => {
    for (const name of ["AccountRepository", "FeeScheduleRepository", "FeeReportPublisher"]) {
      assert.deepEqual(await runtimeExportsOf(`../src/application/ports/out/${name}.ts`), [], name);
    }
  });

  test("outbound ports mention no technology or medium", async () => {
    // A port names a need ("find accounts"), never a carrier. If this test
    // trips, the word belongs in design.md or README, not in the port.
    const forbidden = /file|json|sql|console|http/i;
    for (const name of ["AccountRepository", "FeeScheduleRepository", "FeeReportPublisher"]) {
      const source = await readFile(
        new URL(`../src/application/ports/out/${name}.ts`, import.meta.url),
        "utf8",
      );
      assert.doesNotMatch(source, forbidden, name);
    }
  });
});
