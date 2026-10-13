// ConsoleFeeReportPublisher - FeeReportPublisher that writes one line to a
// text sink, stderr by default.
//
// "Publishing" in a teaching project means: let it be seen that the report
// left the hexagon. One line is enough. It goes to stderr, not stdout, so
// that stdout stays reserved for the driving adapters' real output (the CLI
// table or JSON) and `npm run cli ... | jq` keeps working.

import type { FeeReport } from "../../domain/FeeReport.ts";
import type { FeeReportPublisher } from "../../application/ports/out/FeeReportPublisher.ts";

/**
 * The smallest thing we need from an output: `write(text)`. `process.stderr`
 * satisfies it, and so does `{ write: (s) => lines.push(s) }` in a test.
 * The return type is `unknown` because a WriteStream returns boolean and an
 * array's push returns a number - we ignore it either way.
 */
export type LineSink = { write(chunk: string): unknown };

export class ConsoleFeeReportPublisher implements FeeReportPublisher {
  constructor(private readonly sink: LineSink = process.stderr) {}

  /**
   * `[publish] household hh-1 2026-01-01..2026-03-31 total=14239.73 (3 accounts)`
   *
   * `total` is interpolated as-is: `toFixed(2)` would print `9000.00` for a
   * whole number and introduce a second money format next to the report's.
   * Resolves as soon as the line is handed to the sink - no drain handling,
   * a console is not a slow consumer.
   */
  async publish(report: FeeReport): Promise<void> {
    const count = report.lines.length;
    const noun = count === 1 ? "account" : "accounts";
    this.sink.write(
      `[publish] household ${report.householdId} ${report.period.from}..${report.period.to} ` +
        `total=${report.total} (${count} ${noun})\n`,
    );
  }
}
