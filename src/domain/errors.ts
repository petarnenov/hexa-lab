// Domain errors - the vocabulary of "what can go wrong" inside the hexagon.
//
// Every error extends `DomainError` and carries a stable, machine-readable
// `code`. Outer layers (use case, HTTP, CLI) switch on `code` or use
// `instanceof DomainError` to translate failures into status codes or exit
// codes; they must never parse the human-readable `message`.
//
// `HouseholdNotFound` and `FeeScheduleNotFound` live here even though the
// domain functions never throw them (the use case does, after asking a
// repository). A missing household is a business fact, not a technical
// repository failure, so it belongs to the domain vocabulary.

export abstract class DomainError extends Error {
  /** Stable identifier for this kind of error, e.g. "INVALID_FEE_SCHEDULE". */
  abstract readonly code: string;

  constructor(message: string) {
    super(message);
    // `new.target` is the concrete class being constructed, so every subclass
    // gets a readable `name` (and stack trace header) without repeating this.
    this.name = new.target.name;
  }
}

/** The billing period is malformed: bad ISO date, impossible date, or from > to. */
export class InvalidBillingPeriod extends DomainError {
  readonly code = "INVALID_BILLING_PERIOD";
}

/** The fee schedule breaks the tier rules (empty, non-ascending, null not last). */
export class InvalidFeeSchedule extends DomainError {
  readonly code = "INVALID_FEE_SCHEDULE";
}

/** No household with this id exists. Raised by the use case, defined here. */
export class HouseholdNotFound extends DomainError {
  readonly code = "HOUSEHOLD_NOT_FOUND";

  constructor(readonly householdId: string) {
    super(`Household not found: ${householdId}`);
  }
}

/** An account references a fee schedule id that does not exist. */
export class FeeScheduleNotFound extends DomainError {
  readonly code = "FEE_SCHEDULE_NOT_FOUND";

  constructor(readonly feeScheduleId: string) {
    super(`Fee schedule not found: ${feeScheduleId}`);
  }
}
