// BillingPeriod - the inclusive date range a fee is charged for.
//
// Dates are calendar days in `YYYY-MM-DD` form, interpreted in UTC. The
// domain never asks "what is today" - the period always comes from outside
// (CLI argument, HTTP body), which keeps every calculation deterministic.

import { InvalidBillingPeriod } from "./errors.ts";

/** A calendar date as `YYYY-MM-DD`. Validated by `createBillingPeriod`, not by the type. */
export type IsoDate = string;

export type BillingPeriod = {
  readonly from: IsoDate;
  readonly to: IsoDate;
};

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 86_400_000;

/**
 * Parses `YYYY-MM-DD` into a UTC timestamp, or throws InvalidBillingPeriod.
 *
 * We do not use `new Date(text)`: depending on the engine it either returns
 * `Invalid Date` or silently normalises "2026-02-30" to March 2nd. Building
 * the date with `Date.UTC` and reading the fields back catches both cases.
 */
function parseIsoDate(text: string, label: "from" | "to"): number {
  const match = ISO_DATE.exec(text);
  if (match === null) {
    throw new InvalidBillingPeriod(`${label} must be YYYY-MM-DD, got "${text}"`);
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utc = Date.UTC(year, month - 1, day);
  const date = new Date(utc);
  const roundTrips =
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;
  if (!roundTrips) {
    throw new InvalidBillingPeriod(`${label} is not a real calendar date: "${text}"`);
  }
  return utc;
}

/** Validates both dates and their order (`from <= to`); equal dates are a one-day period. */
export function createBillingPeriod(from: string, to: string): BillingPeriod {
  const fromUtc = parseIsoDate(from, "from");
  const toUtc = parseIsoDate(to, "to");
  if (fromUtc > toUtc) {
    throw new InvalidBillingPeriod(`from (${from}) must not be after to (${to})`);
  }
  return { from, to };
}

/** Number of calendar days in the period, both ends inclusive, counted in UTC (no DST surprises). */
export function daysInPeriod(period: BillingPeriod): number {
  const fromUtc = parseIsoDate(period.from, "from");
  const toUtc = parseIsoDate(period.to, "to");
  return (toUtc - fromUtc) / MS_PER_DAY + 1;
}
