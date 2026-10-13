// CalculateHouseholdFees - the driving (inbound) port of the application.
//
// This is the one door through which the outside world asks the hexagon to
// do its job. Driving adapters (CLI, HTTP, later MCP) depend on this
// interface; the use case in application/ implements it. Neither side knows
// about the other - they only share this file.
//
// Ports are `interface`s, not `type`s like the domain values: a port is
// behaviour that somebody implements, a domain type is data that somebody
// carries. The contrast is deliberate.

import type { FeeReport } from "../../../domain/FeeReport.ts";

/**
 * What a caller has to supply. Dates are raw `YYYY-MM-DD` strings on purpose:
 * an adapter should not know how to validate a date. The use case turns them
 * into a BillingPeriod exactly once and raises InvalidBillingPeriod on bad
 * input, so every adapter translates the same error in the same place.
 */
export type CalculateHouseholdFeesCommand = {
  readonly householdId: string;
  readonly from: string;
  readonly to: string;
};

export interface CalculateHouseholdFees {
  /** Resolves with the household's fee report; rejects with a DomainError. */
  execute(command: CalculateHouseholdFeesCommand): Promise<FeeReport>;
}
