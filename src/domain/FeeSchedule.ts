// FeeSchedule - a tiered annual fee tariff expressed in basis points.
//
// Tiers are marginal: only the slice of AUM that falls inside a tier is
// charged at that tier's rate (like income tax brackets). Validity rules
// (ascending `upTo`, `null` only last, at least one tier) are enforced by
// `validateFeeSchedule` in tieredFee.ts, not by the type.

export type FeeTier = {
  /** Upper bound of the tier in AUM units (inclusive). `null` = no upper bound; only allowed on the last tier. */
  readonly upTo: number | null;
  /** Annual rate in basis points: 100 bps = 1 % per year. */
  readonly annualRateBps: number;
};

export type FeeSchedule = {
  readonly id: string;
  readonly name: string;
  /** Ordered from lowest to highest `upTo`. */
  readonly tiers: readonly FeeTier[];
  /** Floor for the annual fee: max(tiered fee, minimumAnnualFee) is charged. */
  readonly minimumAnnualFee: number;
};
