// TextFileFeeScheduleRepository - FeeScheduleRepository over a plain text file.
//
// data/fee-schedules.txt holds one schedule per line, four `|`-separated
// fields; the tiers are a comma-separated list of `upTo@annualRateBps`, with
// `*` for the open-ended last tier:
//
//   # id     | name     | minimumAnnualFee | tiers
//   standard | Standard | 2500             | 1000000@100, 5000000@75, *@50
//
// Blank lines and `#` comments are skipped. Read on every call, like its
// sibling TextFileAccountRepository, whose read-and-check code is duplicated
// here for the same reason the JSON pair duplicates theirs: adapters/out may
// not import one another (test/architecture.test.ts).

import { readFile } from "node:fs/promises";

import type { FeeSchedule, FeeTier } from "../../domain/FeeSchedule.ts";
import type { FeeScheduleRepository } from "../../application/ports/out/FeeScheduleRepository.ts";

export class TextFileFeeScheduleRepository implements FeeScheduleRepository {
  constructor(private readonly filePath: string) {}

  async findById(id: string): Promise<FeeSchedule | undefined> {
    const schedules = await this.readAll();
    return schedules.find((schedule) => schedule.id === id);
  }

  /** Same contract as in TextFileAccountRepository: any failure is a plain Error naming `<path>:<line>`. */
  private async readAll(): Promise<FeeSchedule[]> {
    let text: string;
    try {
      text = await readFile(this.filePath, "utf8");
    } catch (cause) {
      throw new Error(`${this.filePath}: cannot read file (${(cause as Error).message})`, { cause });
    }
    const schedules: FeeSchedule[] = [];
    text.split(/\r?\n/).forEach((raw, index) => {
      const line = raw.trim();
      if (line === "" || line.startsWith("#")) return;
      schedules.push(this.toSchedule(line, index + 1));
    });
    return schedules;
  }

  /**
   * Structural check only: field count and numbers. Whether the tiers make
   * sense (ascending, `*` last) is a business rule and stays with
   * validateFeeSchedule in domain/, which runs when a fee is calculated.
   */
  private toSchedule(line: string, lineNumber: number): FeeSchedule {
    const where = `${this.filePath}:${lineNumber}`;
    const fields = line.split("|").map((field) => field.trim());
    if (fields.length !== 4) {
      throw new Error(`${where}: expected 4 fields (id | name | minimumAnnualFee | tiers), got ${fields.length}`);
    }
    const [id, name, minimumText, tiersText] = fields as [string, string, string, string];
    const minimumAnnualFee = toNumber(minimumText, `${where}: minimumAnnualFee`);
    if (tiersText === "") throw new Error(`${where}: tiers must not be empty`);
    const tiers: FeeTier[] = tiersText.split(",").map((rawTier) => {
      const tier = rawTier.trim();
      const parts = tier.split("@").map((part) => part.trim());
      if (parts.length !== 2) throw new Error(`${where}: tier "${tier}" must be upTo@annualRateBps`);
      const [upToText, rateText] = parts as [string, string];
      const upTo = upToText === "*" ? null : toNumber(upToText, `${where}: tier "${tier}" upTo`);
      return { upTo, annualRateBps: toNumber(rateText, `${where}: tier "${tier}" annualRateBps`) };
    });
    return { id, name, tiers, minimumAnnualFee };
  }
}

/** `Number("")` is 0, so an empty field is rejected explicitly. */
function toNumber(text: string, what: string): number {
  const value = Number(text);
  if (text === "" || !Number.isFinite(value)) throw new Error(`${what} must be a number (got "${text}")`);
  return value;
}
