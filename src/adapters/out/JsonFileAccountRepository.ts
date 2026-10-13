// JsonFileAccountRepository - AccountRepository over a JSON file on disk.
//
// The file is a plain JSON array of Account objects (data/accounts.json),
// one-to-one with the domain type, so "ORM" here is JSON.parse plus a shape
// check. The file is read on *every* call, on purpose: edit the file, run the
// CLI again, see the change - no cache to invalidate, no restart. The cost
// (one small read per request) is nothing in a teaching project.
//
// Nothing in this file is shared with JsonFileFeeScheduleRepository although
// the read-and-check code is nearly identical. The dependency rule
// (test/architecture.test.ts) forbids one adapter importing another: what
// two adapters would share belongs in domain/ or behind a port, and fifteen
// duplicated lines are cheaper than weakening that rule.

import { readFile } from "node:fs/promises";

import type { Account } from "../../domain/Account.ts";
import type { AccountRepository } from "../../application/ports/out/AccountRepository.ts";

export class JsonFileAccountRepository implements AccountRepository {
  constructor(private readonly filePath: string) {}

  async findByHouseholdId(householdId: string): Promise<readonly Account[]> {
    const accounts = await this.readAll();
    return accounts.filter((account) => account.householdId === householdId);
  }

  /**
   * Reads, parses and shape-checks the whole file. Every failure - missing
   * file, bad JSON, wrong shape - is thrown as a plain Error whose message
   * starts with the path. Plain Error, not DomainError: a broken data file
   * is an infrastructure problem, and the driving adapters translate it as
   * such (500 / exit 1), never as a business outcome like "no accounts".
   */
  private async readAll(): Promise<Account[]> {
    let text: string;
    try {
      text = await readFile(this.filePath, "utf8");
    } catch (cause) {
      throw new Error(`${this.filePath}: cannot read file (${(cause as Error).message})`, { cause });
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (cause) {
      throw new Error(`${this.filePath}: not valid JSON (${(cause as Error).message})`, { cause });
    }
    if (!Array.isArray(parsed)) {
      throw new Error(`${this.filePath}: expected a JSON array of accounts`);
    }
    return parsed.map((item, index) => this.toAccount(item, index));
  }

  /** Structural check only - field presence and type; business rules stay in domain/. */
  private toAccount(item: unknown, index: number): Account {
    const where = `${this.filePath}: accounts[${index}]`;
    if (typeof item !== "object" || item === null) throw new Error(`${where} must be an object`);
    const record = item as Record<string, unknown>;
    for (const field of ["id", "householdId", "name", "feeScheduleId"] as const) {
      if (typeof record[field] !== "string") throw new Error(`${where}.${field} must be a string`);
    }
    if (typeof record.aum !== "number") throw new Error(`${where}.aum must be a number`);
    return {
      id: record.id as string,
      householdId: record.householdId as string,
      name: record.name as string,
      aum: record.aum,
      feeScheduleId: record.feeScheduleId as string,
    };
  }
}
