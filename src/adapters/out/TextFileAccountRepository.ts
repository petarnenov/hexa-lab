// TextFileAccountRepository - AccountRepository over a plain text file.
//
// data/accounts.txt holds one account per line, five fields separated by
// `|`, in the order of the domain type:
//
//   # id    | householdId | name  | aum     | feeScheduleId
//   acc-1   | hh-1        | Alpha | 2500000 | standard
//
// Blank lines and lines starting with `#` are skipped, spaces around a field
// are trimmed. A format a human edits in any editor, with no quoting rules:
// a `|` inside a name is simply not supported. Like the JSON repository, the
// file is read on *every* call - edit, re-run, see the change.
//
// The read-and-check code is duplicated in TextFileFeeScheduleRepository on
// purpose: adapters/out may not import one another (test/architecture.test.ts).

import { readFile } from "node:fs/promises";

import type { Account } from "../../domain/Account.ts";
import type { AccountRepository } from "../../application/ports/out/AccountRepository.ts";

export class TextFileAccountRepository implements AccountRepository {
  constructor(private readonly filePath: string) {}

  async findByHouseholdId(householdId: string): Promise<readonly Account[]> {
    const accounts = await this.readAll();
    return accounts.filter((account) => account.householdId === householdId);
  }

  /**
   * Reads and parses the whole file. Every failure - missing file, wrong
   * number of fields, a non-numeric aum - is a plain Error whose message
   * starts with `<path>:<line>`, so the reader knows which line to fix.
   * Plain Error, not DomainError: a broken data file is infrastructure.
   */
  private async readAll(): Promise<Account[]> {
    let text: string;
    try {
      text = await readFile(this.filePath, "utf8");
    } catch (cause) {
      throw new Error(`${this.filePath}: cannot read file (${(cause as Error).message})`, { cause });
    }
    const accounts: Account[] = [];
    text.split(/\r?\n/).forEach((raw, index) => {
      const line = raw.trim();
      if (line === "" || line.startsWith("#")) return;
      accounts.push(this.toAccount(line, index + 1));
    });
    return accounts;
  }

  /** Structural check only - field count and the number; business rules stay in domain/. */
  private toAccount(line: string, lineNumber: number): Account {
    const where = `${this.filePath}:${lineNumber}`;
    const fields = line.split("|").map((field) => field.trim());
    if (fields.length !== 5) {
      throw new Error(`${where}: expected 5 fields (id | householdId | name | aum | feeScheduleId), got ${fields.length}`);
    }
    const [id, householdId, name, aumText, feeScheduleId] = fields as [string, string, string, string, string];
    const aum = Number(aumText);
    if (aumText === "" || !Number.isFinite(aum)) throw new Error(`${where}: aum must be a number (got "${aumText}")`);
    return { id, householdId, name, aum, feeScheduleId };
  }
}
