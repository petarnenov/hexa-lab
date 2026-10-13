// FeeReport - the result of calculating a household's fees for a period.
//
// A pure data structure plus one function that only sums. It deliberately
// does not call feeForPeriod: the use case decides how each line is produced
// (each account with its own schedule), the report just assembles them. That
// keeps every driving adapter (CLI, HTTP) showing exactly the same numbers.

import type { BillingPeriod } from "./BillingPeriod.ts";
import { roundToCents } from "./tieredFee.ts";

export type FeeLine = {
  readonly accountId: string;
  readonly accountName: string;
  readonly aum: number;
  readonly feeScheduleId: string;
  /** Fee for the period, already rounded to cents by feeForPeriod. */
  readonly fee: number;
};

export type FeeReport = {
  readonly householdId: string;
  readonly period: BillingPeriod;
  /** In the order they were given; never re-sorted here. */
  readonly lines: readonly FeeLine[];
  /** Sum of the (already rounded) line fees, rounded again to kill float noise. */
  readonly total: number;
};

/** Assembles a report; lines are taken as-is, total = round2(sum of line fees). */
export function buildFeeReport(
  householdId: string,
  period: BillingPeriod,
  lines: readonly FeeLine[],
): FeeReport {
  const total = roundToCents(lines.reduce((sum, line) => sum + line.fee, 0));
  return { householdId, period, lines, total };
}
