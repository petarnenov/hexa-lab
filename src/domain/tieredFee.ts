// tieredFee - the only place in the project where money is calculated.
//
// Pure functions over plain values: AUM in, fee out. No I/O, no clock, no
// rounding until the very end (feeForPeriod), so intermediate precision is
// never lost.

import type { BillingPeriod } from "./BillingPeriod.ts";
import { daysInPeriod } from "./BillingPeriod.ts";
import { InvalidFeeSchedule } from "./errors.ts";
import type { FeeSchedule } from "./FeeSchedule.ts";

/**
 * Throws InvalidFeeSchedule unless the tiers are well-formed:
 * at least one tier, strictly ascending `upTo`, and `null` only on the last.
 *
 * Kept separate from annualTieredFee so a repository or use case can validate
 * a schedule when it is loaded, before there is any AUM to calculate on.
 */
export function validateFeeSchedule(schedule: FeeSchedule): void {
  const { tiers } = schedule;
  if (tiers.length === 0) {
    throw new InvalidFeeSchedule(`Fee schedule "${schedule.id}" has no tiers`);
  }
  let previousUpTo = -Infinity;
  tiers.forEach((tier, index) => {
    const isLast = index === tiers.length - 1;
    if (tier.upTo === null) {
      if (!isLast) {
        throw new InvalidFeeSchedule(
          `Fee schedule "${schedule.id}": tier ${index} has upTo=null but is not the last tier`,
        );
      }
      return;
    }
    if (tier.upTo <= previousUpTo) {
      throw new InvalidFeeSchedule(
        `Fee schedule "${schedule.id}": tier ${index} upTo=${tier.upTo} is not above the previous tier (${previousUpTo})`,
      );
    }
    previousUpTo = tier.upTo;
  });
}

/**
 * Annual fee before minimum and rounding, calculated marginally:
 * each slice of AUM is charged at the rate of the tier it falls into.
 *
 *   standard, AUM 2.5M:  1 000 000 x 1 %  +  1 500 000 x 0.75 %  = 21 250
 *
 * AUM exactly on a boundary belongs to the lower tier (`<= upTo`).
 * Negative or zero AUM yields 0 because every slice is clamped at 0.
 */
export function annualTieredFee(aum: number, schedule: FeeSchedule): number {
  validateFeeSchedule(schedule);
  let fee = 0;
  let lowerBound = 0;
  for (const tier of schedule.tiers) {
    const upperBound = tier.upTo ?? Infinity;
    const slice = Math.max(0, Math.min(aum, upperBound) - lowerBound);
    fee += slice * (tier.annualRateBps / 10_000);
    if (aum <= upperBound) break;
    lowerBound = upperBound;
  }
  return fee;
}

/**
 * Rounds to two decimals, half up for positive values.
 *
 * `Number.EPSILON` nudges values like 1.005 (really 1.00499999...) over the
 * edge so they round the way a human expects. Call this only on final
 * outputs - never on intermediate results - to avoid accumulating error.
 */
export function roundToCents(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Days in a year for pro-rating. Fixed by the spec, even across leap years. */
const DAYS_PER_YEAR = 365;

/**
 * Fee owed for the period:
 *
 *   round2( max(annualTieredFee, minimumAnnualFee) x days / 365 )
 *
 * The minimum applies to the annual amount before pro-rating, so a small
 * account pays 2 500 x 90 / 365 for a quarter, not a flat 2 500.
 */
export function feeForPeriod(aum: number, schedule: FeeSchedule, period: BillingPeriod): number {
  const annual = Math.max(annualTieredFee(aum, schedule), schedule.minimumAnnualFee);
  return roundToCents((annual * daysInPeriod(period)) / DAYS_PER_YEAR);
}
