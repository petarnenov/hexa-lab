// cli.main - the process entry point behind `npm run cli`.
//
// One line, because everything that is "process" lives in exactly one place:
//   - `composeApp()` with no arguments reads process.env and logs to
//     process.stderr (compose.ts);
//   - `process.argv.slice(2)` drops node and this script - the CLI adapter
//     wants only the user's arguments (runCli.ts);
//   - `runCli` with no `out` writes to the process streams;
//   - the returned exit code goes to `process.exitCode`, never `process.exit()`,
//     so a still-flushing stdout is not cut off.
//
// A misconfiguration (`STORAGE=sqlite`) makes `composeApp` throw before the
// adapter is even called. It is left unhandled on purpose: Node prints the
// error's message as the first line, then the stack, and exits with 1. A
// try/catch here would only add a second error format for the same message.
//
// Nothing is exported: a main is run, not imported. Top-level await is plain
// ESM, which tsx runs as-is.

import { runCli } from "../adapters/in/runCli.ts";
import { composeApp } from "./compose.ts";

process.exitCode = await runCli(composeApp(), process.argv.slice(2));
