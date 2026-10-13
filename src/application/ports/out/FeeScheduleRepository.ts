// FeeScheduleRepository - a driven (outbound) port: "give me the fee
// schedule with this id".
//
// Same shape of contract as AccountRepository: the application asks in
// domain terms and gets a domain value back, with no hint of where the
// tariffs live.
//
// Consumed by: CalculateHouseholdFeesService (application).
// Implemented by: the fee schedule repositories in adapters/out.

import type { FeeSchedule } from "../../../domain/FeeSchedule.ts";

export interface FeeScheduleRepository {
  /**
   * The schedule with this id, or `undefined` when there is none.
   *
   * The storage reports absence; the use case decides it is an error
   * (FeeScheduleNotFound). Keeping that decision out of the repository means
   * every adapter behaves identically and the domain error has one source.
   */
  findById(id: string): Promise<FeeSchedule | undefined>;
}
