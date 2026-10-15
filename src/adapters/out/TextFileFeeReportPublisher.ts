// TextFileFeeReportPublisher - FeeReportPublisher that appends each report to
// a plain text file.
//
// Where ConsoleFeeReportPublisher only shows that a report left the hexagon,
// this one keeps it: every publish appends one block, so the file is a log
// of every report, oldest first. The block uses the same `|`-separated style
// as the text repositories:
//
//   household hh-1 | 2026-01-01..2026-03-31
//   acc-1 | Alpha | 2500000 | standard | 5239.73
//   total | 14239.73
//   <empty line>
//
// Numbers are interpolated as-is, like the console line: one money format.

import { appendFile } from "node:fs/promises";

import type { FeeReport } from "../../domain/FeeReport.ts";
import type { FeeReportPublisher } from "../../application/ports/out/FeeReportPublisher.ts";

export class TextFileFeeReportPublisher implements FeeReportPublisher {
  constructor(private readonly filePath: string) {}

  /**
   * One `appendFile` per report: the file is created if missing, never
   * truncated, and the block lands in one write. A missing directory or an
   * unwritable file rejects with a plain Error naming the path - the use
   * case's `execute` rejects with it, and the driving adapters report an
   * infrastructure failure (500 / exit 1).
   */
  async publish(report: FeeReport): Promise<void> {
    const lines = [
      `household ${report.householdId} | ${report.period.from}..${report.period.to}`,
      ...report.lines.map((l) => `${l.accountId} | ${l.accountName} | ${l.aum} | ${l.feeScheduleId} | ${l.fee}`),
      `total | ${report.total}`,
    ];
    try {
      await appendFile(this.filePath, `${lines.join("\n")}\n\n`, "utf8");
    } catch (cause) {
      throw new Error(`${this.filePath}: cannot append report (${(cause as Error).message})`, { cause });
    }
  }
}
