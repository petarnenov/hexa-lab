// CalculateHouseholdFeesService - the use case; the only place where the
// ports are orchestrated.
//
// It is a class that `implements` the inbound port: if the port and the
// service ever disagree, `tsc` points at this line, not at some caller - the
// port is a contract and this is where it is honoured. Everything the use
// case needs from the outside world arrives through the constructor (manual
// dependency injection, no container): three outbound ports, nothing else.
// No file, no network, no environment, no logging - which is exactly why it
// can be tested with three in-memory fakes.

import type { CalculateHouseholdFees, CalculateHouseholdFeesCommand } from "./ports/in/CalculateHouseholdFees.ts";
import type { AccountRepository } from "./ports/out/AccountRepository.ts";
import type { FeeScheduleRepository } from "./ports/out/FeeScheduleRepository.ts";
import type { FeeReportPublisher } from "./ports/out/FeeReportPublisher.ts";
import type { Account } from "../domain/Account.ts";
import type { BillingPeriod } from "../domain/BillingPeriod.ts";
import type { FeeSchedule } from "../domain/FeeSchedule.ts";
import type { FeeLine, FeeReport } from "../domain/FeeReport.ts";
import { createBillingPeriod } from "../domain/BillingPeriod.ts";
import { FeeScheduleNotFound, HouseholdNotFound } from "../domain/errors.ts";
import { buildFeeReport } from "../domain/FeeReport.ts";
import { feeForPeriod } from "../domain/tieredFee.ts";

export class CalculateHouseholdFeesService implements CalculateHouseholdFees {
  constructor(
    private readonly accounts: AccountRepository,
    private readonly schedules: FeeScheduleRepository,
    private readonly publisher: FeeReportPublisher,
  ) {}

  /**
   * The whole use case, top to bottom:
   *   period -> accounts -> schedules (once per id) -> lines sorted by
   *   account id -> report -> publish -> return.
   */
  async execute(command: CalculateHouseholdFeesCommand): Promise<FeeReport> {
    // 1. Validate the period before the first `await`: bad input never
    //    reaches a repository. Thrown inside an async function, so the
    //    caller still sees a rejected promise - one channel for all errors.
    const period = createBillingPeriod(command.from, command.to);

    // 2. The accounts billed together under this household. The repository
    //    reports "none" as an empty list; deciding that this is an error is
    //    a business rule, so it lives here, not in the storage.
    const accounts = await this.accounts.findByHouseholdId(command.householdId);
    if (accounts.length === 0) throw new HouseholdNotFound(command.householdId);

    // 3. Every schedule the accounts refer to, fetched once per id.
    const schedules = await this.loadSchedules(accounts);

    // 4. One line per account, in a stable order. The repository returns a
    //    readonly list, so sort a copy. Plain string comparison on purpose:
    //    ids are opaque strings ("acc-10" < "acc-2"), and no locale sneaks in.
    const lines = [...accounts]
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
      // `!` is safe: loadSchedules either put the id in the map or threw.
      .map((account) => toLine(account, schedules.get(account.feeScheduleId)!, period));

    // 5. Assemble, 6. publish (exactly once, as the last step - so any error
    //    above means nothing was published), 7. return the same object.
    const report = buildFeeReport(command.householdId, period, lines);
    await this.publisher.publish(report);
    return report;
  }

  /**
   * Fetches each distinct schedule id once. Sequential on purpose: with two
   * missing ids the error is deterministically the first one met, and the
   * loop reads as a sentence. (`Promise.all` over the unique ids is a fine
   * exercise; N is 2 here.)
   */
  private async loadSchedules(accounts: readonly Account[]): Promise<Map<string, FeeSchedule>> {
    const byId = new Map<string, FeeSchedule>();
    for (const { feeScheduleId } of accounts) {
      if (byId.has(feeScheduleId)) continue;
      const schedule = await this.schedules.findById(feeScheduleId);
      // Same split as for accounts: the storage says `undefined`, the use
      // case says "that is an error".
      if (schedule === undefined) throw new FeeScheduleNotFound(feeScheduleId);
      byId.set(feeScheduleId, schedule);
    }
    return byId;
  }
}

/** One report line: the account's data plus its fee for the period. */
function toLine(account: Account, schedule: FeeSchedule, period: BillingPeriod): FeeLine {
  return {
    accountId: account.id,
    accountName: account.name,
    aum: account.aum,
    feeScheduleId: account.feeScheduleId,
    fee: feeForPeriod(account.aum, schedule, period),
  };
}
