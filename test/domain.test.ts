// Domain tests (STORY-1.2, extended by STORY-1.5).
//
// One `describe` per capability spec under openspec/specs/, one `test` per
// scenario. Everything here is pure: no I/O, no clock, no adapters. That is
// the whole point of the hexagon's core - it can be tested with plain values.
import { describe, test } from "node:test";
import assert from "node:assert/strict";

import {
  DomainError,
  FeeScheduleNotFound,
  HouseholdNotFound,
  InvalidBillingPeriod,
  InvalidFeeSchedule,
} from "../src/domain/errors.ts";

describe("domain-errors", () => {
  test("every domain error is both a DomainError and an Error", () => {
    const err = new InvalidFeeSchedule("no tiers");
    assert.ok(err instanceof DomainError);
    assert.ok(err instanceof Error);
  });

  test("the four error kinds have distinct codes and class-matching names", () => {
    const errors = [
      new InvalidBillingPeriod("bad"),
      new InvalidFeeSchedule("bad"),
      new HouseholdNotFound("hh-404"),
      new FeeScheduleNotFound("gold"),
    ];
    const codes = new Set(errors.map((e) => e.code));
    assert.equal(codes.size, 4);
    assert.deepEqual(
      errors.map((e) => e.name),
      ["InvalidBillingPeriod", "InvalidFeeSchedule", "HouseholdNotFound", "FeeScheduleNotFound"],
    );
  });

  test("HouseholdNotFound carries the household id", () => {
    const err = new HouseholdNotFound("hh-404");
    assert.equal(err.householdId, "hh-404");
    assert.match(err.message, /hh-404/);
  });

  test("FeeScheduleNotFound carries the fee schedule id", () => {
    const err = new FeeScheduleNotFound("gold");
    assert.equal(err.feeScheduleId, "gold");
    assert.match(err.message, /gold/);
  });
});

import { createBillingPeriod, daysInPeriod } from "../src/domain/BillingPeriod.ts";

describe("billing-period", () => {
  test("a valid period keeps both dates unchanged", () => {
    const period = createBillingPeriod("2026-01-01", "2026-03-31");
    assert.equal(period.from, "2026-01-01");
    assert.equal(period.to, "2026-03-31");
  });

  test("an impossible calendar date is rejected", () => {
    assert.throws(() => createBillingPeriod("2026-01-01", "2026-02-30"), InvalidBillingPeriod);
  });

  test("non-ISO formats are rejected", () => {
    for (const bad of ["01/01/2026", "2026-1-1", "2026-01-01T00:00:00Z"]) {
      assert.throws(() => createBillingPeriod(bad, "2026-03-31"), InvalidBillingPeriod, bad);
    }
  });

  test("from after to is rejected", () => {
    assert.throws(() => createBillingPeriod("2026-03-31", "2026-01-01"), InvalidBillingPeriod);
  });

  test("equal dates form a one-day period", () => {
    const period = createBillingPeriod("2026-01-01", "2026-01-01");
    assert.equal(daysInPeriod(period), 1);
  });

  test("Q1 2026 has 90 days (inclusive)", () => {
    assert.equal(daysInPeriod(createBillingPeriod("2026-01-01", "2026-03-31")), 90);
  });

  test("a leap year has 366 days", () => {
    assert.equal(daysInPeriod(createBillingPeriod("2024-01-01", "2024-12-31")), 366);
  });
});

import type { FeeSchedule } from "../src/domain/FeeSchedule.ts";
import {
  annualTieredFee,
  feeForPeriod,
  roundToCents,
  validateFeeSchedule,
} from "../src/domain/tieredFee.ts";

// The "standard" tariff from the blueprint: 1 % up to 1M, 0.75 % up to 5M,
// 0.5 % above, with a 2 500 annual floor. All blueprint numbers derive from it.
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

const withTiers = (tiers: FeeSchedule["tiers"]): FeeSchedule => ({ ...standard, tiers });

describe("tiered-fee-calculation", () => {
  describe("schedule validation", () => {
    test("a valid schedule with an open last tier passes", () => {
      assert.doesNotThrow(() => validateFeeSchedule(standard));
    });

    test("a schedule without tiers is rejected", () => {
      assert.throws(() => validateFeeSchedule(withTiers([])), InvalidFeeSchedule);
    });

    test("non-ascending upper bounds are rejected", () => {
      const tiers = [
        { upTo: 5_000_000, annualRateBps: 75 },
        { upTo: 1_000_000, annualRateBps: 100 },
        { upTo: null, annualRateBps: 50 },
      ];
      assert.throws(() => validateFeeSchedule(withTiers(tiers)), InvalidFeeSchedule);
    });

    test("null upTo anywhere but last is rejected", () => {
      const tiers = [
        { upTo: null, annualRateBps: 50 },
        { upTo: 1_000_000, annualRateBps: 100 },
      ];
      assert.throws(() => validateFeeSchedule(withTiers(tiers)), InvalidFeeSchedule);
    });

    test("equal upper bounds are rejected", () => {
      const tiers = [
        { upTo: 1_000_000, annualRateBps: 100 },
        { upTo: 1_000_000, annualRateBps: 75 },
        { upTo: null, annualRateBps: 50 },
      ];
      assert.throws(() => validateFeeSchedule(withTiers(tiers)), InvalidFeeSchedule);
    });
  });

  describe("annual marginal fee", () => {
    test("150k sits entirely in the first tier: 1 500", () => {
      assert.equal(annualTieredFee(150_000, standard), 1_500);
    });

    test("2.5M spans two tiers: 10 000 + 11 250 = 21 250", () => {
      assert.equal(annualTieredFee(2_500_000, standard), 21_250);
    });

    test("6M reaches the open tier: 10 000 + 30 000 + 5 000 = 45 000", () => {
      assert.equal(annualTieredFee(6_000_000, standard), 45_000);
    });

    test("exactly on a boundary charges only the lower tier", () => {
      assert.equal(annualTieredFee(1_000_000, standard), 10_000);
    });

    test("zero AUM yields zero", () => {
      assert.equal(annualTieredFee(0, standard), 0);
    });

    test("an invalid schedule is rejected before calculating", () => {
      assert.throws(() => annualTieredFee(100, withTiers([])), InvalidFeeSchedule);
    });
  });

  describe("roundToCents", () => {
    test("half a cent rounds up", () => {
      assert.equal(roundToCents(5_239.725), 5_239.73);
    });

    test("below half a cent rounds down", () => {
      assert.equal(roundToCents(58.2191), 58.22);
    });

    test("binary noise does not flip the direction (1.005 -> 1.01)", () => {
      assert.equal(roundToCents(1.005), 1.01);
    });
  });

  describe("fee for a period", () => {
    const q1 = createBillingPeriod("2026-01-01", "2026-03-31");
    const fullYear = createBillingPeriod("2026-01-01", "2026-12-31");

    test("the minimum annual fee wins over a smaller tiered fee", () => {
      assert.equal(feeForPeriod(150_000, standard, fullYear), 2_500);
    });

    test("2.5M for Q1 2026 (90 days): 21 250 x 90 / 365 = 5 239.73", () => {
      assert.equal(feeForPeriod(2_500_000, standard, q1), 5_239.73);
    });

    test("a single day: 21 250 / 365 = 58.22", () => {
      const oneDay = createBillingPeriod("2026-01-01", "2026-01-01");
      assert.equal(feeForPeriod(2_500_000, standard, oneDay), 58.22);
    });

    test("366 days still divides by 365: 21 308.22", () => {
      const leapYear = createBillingPeriod("2024-01-01", "2024-12-31");
      assert.equal(feeForPeriod(2_500_000, standard, leapYear), 21_308.22);
    });
  });
});

import type { FeeLine } from "../src/domain/FeeReport.ts";
import { buildFeeReport } from "../src/domain/FeeReport.ts";

describe("fee-report", () => {
  const q1 = createBillingPeriod("2026-01-01", "2026-03-31");
  const line = (accountId: string, fee: number): FeeLine => ({
    accountId,
    accountName: `Account ${accountId}`,
    aum: 0,
    feeScheduleId: "standard",
    fee,
  });

  test("a two-line report keeps household, period, line order and sums to 14 239.73", () => {
    const lines = [line("acc-1", 5_239.73), line("acc-2", 9_000)];
    const report = buildFeeReport("hh-1", q1, lines);
    assert.equal(report.householdId, "hh-1");
    assert.deepEqual(report.period, q1);
    assert.deepEqual(report.lines, lines);
    assert.equal(report.total, 14_239.73);
  });

  test("the total has no binary noise (0.10 + 0.20 = 0.30)", () => {
    const report = buildFeeReport("hh-1", q1, [line("a", 0.1), line("b", 0.2)]);
    assert.equal(report.total, 0.3);
  });

  test("a household without accounts has an empty report with total 0", () => {
    const report = buildFeeReport("hh-empty", q1, []);
    assert.deepEqual(report.lines, []);
    assert.equal(report.total, 0);
  });
});
