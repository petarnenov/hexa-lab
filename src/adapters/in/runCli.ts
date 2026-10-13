// runCli - the terminal driving adapter: `<householdId> <from> <to> [--json]`.
//
// Same inbound port as the HTTP adapter, different protocol: arguments in,
// text out, an exit code to finish. Like createHttpServer this is a function
// that *consumes* a port, not a class that implements one. Everything that is
// "terminal" - argument parsing, the table, the exit code convention - lives
// here and nowhere else.
//
// The adapter never touches `process` itself: `argv` is handed in (without
// node and the script - bootstrap passes `process.argv.slice(2)`), output goes
// to the sinks in `out` (the process streams only by default), and the exit
// code is *returned*, not applied. `process.exit` would make this untestable
// and could cut off a still-flushing stdout; bootstrap does
// `process.exitCode = await runCli(...)` instead.

import type { CalculateHouseholdFees } from "../../application/ports/in/CalculateHouseholdFees.ts";
import type { FeeReport } from "../../domain/FeeReport.ts";
import { DomainError } from "../../domain/errors.ts";

/**
 * The smallest thing we need from an output stream. This duplicates
 * `LineSink` from adapters/out/ConsoleFeeReportPublisher on purpose: an
 * inbound adapter may not import an outbound one (test/architecture.test.ts),
 * and hoisting a stream type into application/ would make the hexagon know
 * about streams. Two three-line types are the cheaper price.
 */
export type TextSink = { write(chunk: string): unknown };

export type CliOutput = {
  readonly stdout: TextSink;
  readonly stderr: TextSink;
};

/** Exit codes, Unix style: 0 success, 1 the request failed, 2 bad usage. */
export const EXIT_OK = 0;
export const EXIT_FAILED = 1;
export const EXIT_USAGE = 2;

// No program name: the adapter cannot know whether it is run via `npm run
// cli`, `tsx` or a packaged binary, so it describes only the arguments.
const USAGE = "usage: <householdId> <from> <to> [--json]\n";

/**
 * Runs one command. Resolves with the exit code. Rejects only on an error
 * that is not a domain error - see the catch block.
 */
export async function runCli(
  useCase: CalculateHouseholdFees,
  argv: readonly string[],
  out: CliOutput = { stdout: process.stdout, stderr: process.stderr },
): Promise<number> {
  const args = parseArgs(argv);
  if (args === undefined) {
    out.stderr.write(USAGE);
    return EXIT_USAGE;
  }

  try {
    const report = await useCase.execute(args.command);
    out.stdout.write(args.json ? renderJson(report) : renderTable(report));
    return EXIT_OK;
  } catch (error) {
    // The only place a domain error becomes an exit code. Any DomainError is
    // "the request failed" (exit 1) - the base class is enough, the subclass
    // only changes the text. Anything else is a bug or an infrastructure
    // failure: it is rethrown so Node prints the stack and exits non-zero,
    // instead of being flattened into a one-liner that hides the cause.
    if (error instanceof DomainError) {
      out.stderr.write(`${error.code}: ${error.message}\n`);
      return EXIT_FAILED;
    }
    throw error;
  }
}

type ParsedArgs = {
  readonly command: { householdId: string; from: string; to: string };
  readonly json: boolean;
};

/**
 * Splits `argv` into flags (`--x`) and positionals. The only flag we know is
 * `--json`, anywhere in the list; anything else - another flag, or not
 * exactly three positionals - is a usage error, reported as `undefined`.
 */
function parseArgs(argv: readonly string[]): ParsedArgs | undefined {
  const positionals: string[] = [];
  let json = false;
  for (const arg of argv) {
    if (arg === "--json") json = true;
    else if (arg.startsWith("--")) return undefined;
    else positionals.push(arg);
  }
  if (positionals.length !== 3) return undefined;
  const [householdId, from, to] = positionals as [string, string, string];
  return { command: { householdId, from, to }, json };
}

/**
 * The human view: a header, one row per account, TOTAL last.
 *
 *   Household hh-1  2026-01-01..2026-03-31
 *   acc-1  Alpha  2500000  standard   5239.73
 *   acc-2  Beta    150000  standard    616.44
 *   acc-3  Gamma  4000000  premium    8383.56
 *   TOTAL                            14239.73
 *
 * Money is `toFixed(2)` here and only here: a table is for people, and
 * "616.44" next to "9000.00" lines up. The JSON output and the console
 * publisher hand the raw number on, because their readers are programs. The
 * two formats never meet - they live in different adapters.
 */
function renderTable(report: FeeReport): string {
  const money = (n: number) => n.toFixed(2);
  const rows = report.lines.map((line) => [
    line.accountId,
    line.accountName,
    String(line.aum),
    line.feeScheduleId,
    money(line.fee),
  ]);
  const totalRow = ["TOTAL", "", "", "", money(report.total)];
  // Column widths from the data, so no name or number is ever cut off.
  const widths = [...rows, totalRow].reduce(
    (acc, row) => acc.map((w, i) => Math.max(w, row[i]!.length)),
    [0, 0, 0, 0, 0],
  );
  // Text left-aligned, numbers (aum, fee) right-aligned.
  const RIGHT = new Set([2, 4]);
  const format = (row: readonly string[]) =>
    row
      .map((cell, i) => (RIGHT.has(i) ? cell.padStart(widths[i]!) : cell.padEnd(widths[i]!)))
      .join("  ")
      .trimEnd();
  const header = `Household ${report.householdId}  ${report.period.from}..${report.period.to}`;
  return [header, ...rows.map(format), format(totalRow)].join("\n") + "\n";
}

/**
 * The same `JSON.stringify(report)` the HTTP adapter sends, plus a newline.
 * No indentation, so `--json` is byte for byte the HTTP body; `| jq` makes it
 * pretty when a human wants that.
 */
function renderJson(report: FeeReport): string {
  return JSON.stringify(report) + "\n";
}
