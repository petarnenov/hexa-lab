// Account - the thing we charge fees on.
//
// A plain data type: the domain does not care whether an account came from a
// JSON file, memory, or a database. Behaviour lives in standalone functions
// (see tieredFee.ts), not in methods, so the type stays a pure value.

export type Account = {
  readonly id: string;
  /** Accounts are billed together per household; the use case groups by this. */
  readonly householdId: string;
  readonly name: string;
  /** Assets Under Management - the market value the fee is calculated on. */
  readonly aum: number;
  /** Which FeeSchedule applies to this account (FeeSchedule.id). */
  readonly feeScheduleId: string;
};
