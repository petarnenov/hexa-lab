// AccountRepository - a driven (outbound) port: "give me the accounts of a
// household".
//
// The application declares the need; an adapter in adapters/out (in-memory,
// a data document on disk, a database in EPIC-2) fulfils it. The port speaks
// only in domain types, so swapping the adapter never touches this port or
// the use case that depends on it.
//
// Consumed by: CalculateHouseholdFeesService (application).
// Implemented by: the account repositories in adapters/out.

import type { Account } from "../../../domain/Account.ts";

export interface AccountRepository {
  /**
   * All accounts billed under this household, in storage order.
   *
   * An unknown household yields an empty list, not an error: whether "no
   * accounts" is a problem is a business decision that belongs to the use
   * case (it raises HouseholdNotFound), not to the storage.
   */
  findByHouseholdId(householdId: string): Promise<readonly Account[]>;
}
