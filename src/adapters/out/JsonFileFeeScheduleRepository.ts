// JsonFileFeeScheduleRepository - FeeScheduleRepository over a JSON file.
//
// data/fee-schedules.json is a JSON array of FeeSchedule objects, one-to-one
// with the domain type. Read on every call, like JsonFileAccountRepository,
// and for the same reason: edit, re-run, see the change.
//
// The read-parse-check code below deliberately duplicates its sibling. The
// dependency rule (test/architecture.test.ts) says adapters/out may import
// domain, application and node built-ins - not each other. A shared helper
// here would be the first crack in "adapters do not know one another"; when
// a third adapter needs the same code, the answer is a port or a domain type,
// not an import between adapters.

import { readFile } from "node:fs/promises";

import type { FeeSchedule, FeeTier } from "../../domain/FeeSchedule.ts";
import type { FeeScheduleRepository } from "../../application/ports/out/FeeScheduleRepository.ts";

export class JsonFileFeeScheduleRepository implements FeeScheduleRepository {
  constructor(private readonly filePath: string) {}

  async findById(id: string): Promise<FeeSchedule | undefined> {
    const schedules = await this.readAll();
    return schedules.find((schedule) => schedule.id === id);
  }

  /** Same contract as in JsonFileAccountRepository: any failure is a plain Error naming the path. */
  private async readAll(): Promise<FeeSchedule[]> {
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
      throw new Error(`${this.filePath}: expected a JSON array of fee schedules`);
    }
    return parsed.map((item, index) => this.toSchedule(item, index));
  }

  /**
   * Structural check only: fields exist and have the right JSON type. Whether
   * the tiers make sense (ascending, null last) is a business rule and stays
   * with validateFeeSchedule in domain/, which runs when a fee is calculated.
   */
  private toSchedule(item: unknown, index: number): FeeSchedule {
    const where = `${this.filePath}: schedules[${index}]`;
    if (typeof item !== "object" || item === null) throw new Error(`${where} must be an object`);
    const record = item as Record<string, unknown>;
    if (typeof record.id !== "string") throw new Error(`${where}.id must be a string`);
    if (typeof record.name !== "string") throw new Error(`${where}.name must be a string`);
    if (typeof record.minimumAnnualFee !== "number") throw new Error(`${where}.minimumAnnualFee must be a number`);
    if (!Array.isArray(record.tiers)) throw new Error(`${where}.tiers must be an array`);
    const tiers: FeeTier[] = record.tiers.map((tier: unknown, tierIndex) => {
      const tierWhere = `${where}.tiers[${tierIndex}]`;
      if (typeof tier !== "object" || tier === null) throw new Error(`${tierWhere} must be an object`);
      const { upTo, annualRateBps } = tier as Record<string, unknown>;
      if (upTo !== null && typeof upTo !== "number") throw new Error(`${tierWhere}.upTo must be a number or null`);
      if (typeof annualRateBps !== "number") throw new Error(`${tierWhere}.annualRateBps must be a number`);
      return { upTo, annualRateBps };
    });
    return { id: record.id, name: record.name, tiers, minimumAnnualFee: record.minimumAnnualFee };
  }
}
