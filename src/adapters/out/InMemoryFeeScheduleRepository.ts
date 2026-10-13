// InMemoryFeeScheduleRepository - FeeScheduleRepository over a Map.
//
// Same idea as InMemoryAccountRepository: data from the constructor, no I/O,
// `implements` so the port is checked at the adapter. A Map keyed by id is
// the natural shape for "find by id"; the Account repository keeps an array
// because its query is a filter, not a lookup.

import type { FeeSchedule } from "../../domain/FeeSchedule.ts";
import type { FeeScheduleRepository } from "../../application/ports/out/FeeScheduleRepository.ts";

export class InMemoryFeeScheduleRepository implements FeeScheduleRepository {
  private readonly byId: ReadonlyMap<string, FeeSchedule>;

  constructor(schedules: readonly FeeSchedule[]) {
    // `new Map(entries)` keeps the last entry for a repeated key, so with a
    // duplicated id the schedule given last wins. Building the Map here also
    // decouples the repository from the caller's array.
    this.byId = new Map(schedules.map((schedule) => [schedule.id, schedule]));
  }

  /** `undefined` for an unknown id - whether that is an error is the use case's call. */
  async findById(id: string): Promise<FeeSchedule | undefined> {
    return this.byId.get(id);
  }
}
