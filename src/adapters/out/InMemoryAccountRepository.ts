// InMemoryAccountRepository - the simplest driven adapter for AccountRepository.
//
// Data arrives through the constructor (the composition root or a test hands
// it over) and lives in a private array. No I/O at all, which makes this the
// reference implementation: every other adapter must give the same answers
// for the same data. `implements` ties the class to the port - if the port
// ever changes, `tsc` fails here, in the adapter, not in some caller.

import type { Account } from "../../domain/Account.ts";
import type { AccountRepository } from "../../application/ports/out/AccountRepository.ts";

export class InMemoryAccountRepository implements AccountRepository {
  private readonly accounts: readonly Account[];

  constructor(accounts: readonly Account[]) {
    // Defensive copy: the caller may keep mutating its own array afterwards
    // (a seed module, a test) and the repository must not notice.
    this.accounts = [...accounts];
  }

  /**
   * `async` on a synchronous body is deliberate: the port promises a Promise
   * so that a file or database adapter can share the signature. `filter`
   * returns a fresh array, so a caller sorting or emptying the result cannot
   * touch the repository's state either.
   */
  async findByHouseholdId(householdId: string): Promise<readonly Account[]> {
    return this.accounts.filter((account) => account.householdId === householdId);
  }
}
