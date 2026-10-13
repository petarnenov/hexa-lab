// seed - the blueprint data for the in-memory storage mode.
//
// This is, field for field, the content of data/accounts.json and
// data/fee-schedules.json. A duplicate on purpose: if memory mode read the
// JSON files once at start-up it would not be a second storage technology,
// only a cached copy of the first, and the lesson of STORY-1.6 - two
// technologies behind one port, the use case cannot tell - would be gone.
// Generating the files from this seed is rejected for the opposite reason:
// the demo (STORY-1.9) wants a human to edit data/*.json and see the result.
//
// The price of the duplicate is paid in test/bootstrap.test.ts, which
// deepEquals both arrays against the parsed files; change one side and
// `npm test` tells you to change the other.
//
// The arrays carry the domain types (not `as const`): `upTo: null` must be
// `number | null`, and a seed that does not typecheck as an Account is wrong.

import type { Account } from "../domain/Account.ts";
import type { FeeSchedule } from "../domain/FeeSchedule.ts";

export const seedAccounts: readonly Account[] = [
  { id: "acc-1", householdId: "hh-1", name: "Alpha", aum: 2_500_000, feeScheduleId: "standard" },
  { id: "acc-2", householdId: "hh-1", name: "Beta", aum: 150_000, feeScheduleId: "standard" },
  { id: "acc-3", householdId: "hh-1", name: "Gamma", aum: 4_000_000, feeScheduleId: "premium" },
  { id: "acc-4", householdId: "hh-2", name: "Delta", aum: 800_000, feeScheduleId: "standard" },
];

export const seedFeeSchedules: readonly FeeSchedule[] = [
  {
    id: "standard",
    name: "Standard",
    tiers: [
      { upTo: 1_000_000, annualRateBps: 100 },
      { upTo: 5_000_000, annualRateBps: 75 },
      { upTo: null, annualRateBps: 50 },
    ],
    minimumAnnualFee: 2_500,
  },
  {
    id: "premium",
    name: "Premium",
    tiers: [{ upTo: null, annualRateBps: 85 }],
    minimumAnnualFee: 5_000,
  },
];
