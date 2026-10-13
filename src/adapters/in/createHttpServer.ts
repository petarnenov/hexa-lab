// createHttpServer - the HTTP driving adapter: `POST /households/:id/fees`.
//
// A driving adapter *consumes* a port, it does not implement one, so this is
// a function rather than a class (contrast the driven adapters in
// adapters/out, which `implements` their ports). Everything that is HTTP -
// routing, reading the body, status codes, JSON envelopes - lives in this
// file. The use case behind the port never learns it was called over HTTP.
//
// The function returns a server that is NOT listening: which port to bind,
// and whether to bind at all, is a decision of the composition root
// (bootstrap/http.main.ts) or of a test (`listen(0)`). That keeps this file
// free of `process.env` and makes it startable many times in one process.

import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { CalculateHouseholdFees, CalculateHouseholdFeesCommand } from "../../application/ports/in/CalculateHouseholdFees.ts";
import { FeeScheduleNotFound, HouseholdNotFound, InvalidBillingPeriod } from "../../domain/errors.ts";

export function createHttpServer(useCase: CalculateHouseholdFees): Server {
  // `createServer` wants a plain callback; `handle` is async so that one
  // try/catch can cover both sync throws and rejected promises. The `void`
  // says "we know this is a promise, and handle() never rejects - every
  // failure path ends in a response".
  return createServer((req, res) => {
    void handle(useCase, req, res);
  });
}

/** The whole request/response cycle for one request. Never throws. */
async function handle(useCase: CalculateHouseholdFees, req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    // 1. Route first: for an unknown path or method the body is irrelevant,
    //    so it is never read.
    const householdId = matchRoute(req);
    if (householdId === undefined) {
      respond(res, 404, { error: "NOT_FOUND", message: `No route for ${req.method} ${req.url}` });
      return;
    }

    // 2. Body -> command. The adapter shapes the input; it does not judge it
    //    (dates are validated by the use case).
    const command = toCommand(householdId, await readJsonBody(req));

    // 3. The use case. Its result goes out exactly as JSON.stringify sees
    //    it - the CLI's --json output must be the same text.
    const report = await useCase.execute(command);
    respond(res, 200, report);
  } catch (error) {
    // 4. One translation point for every failure - this is the only place
    //    in the system where a domain error becomes an HTTP status.
    const { status, body } = statusOf(error);
    if (status === 500) console.error(error); // a bug must not vanish silently
    respond(res, status, body);
  }
}

type ErrorBody = { readonly error: string; readonly message: string };

/**
 * Error -> status and `{ error, message }` body. Matching on the concrete
 * classes (not on `code` strings) uses only the public API of errors.ts and
 * reads like the backlog item: InvalidBillingPeriod -> 400, *NotFound -> 404,
 * everything else -> 500. InvalidFeeSchedule lands in 500 on purpose: a
 * broken tariff is a problem with the server's data, not with the request.
 * The 500 body never carries the real message - that is for the server log.
 */
function statusOf(error: unknown): { status: number; body: ErrorBody } {
  if (error instanceof BadRequest || error instanceof InvalidBillingPeriod) {
    return { status: 400, body: { error: error.code, message: error.message } };
  }
  if (error instanceof HouseholdNotFound || error instanceof FeeScheduleNotFound) {
    return { status: 404, body: { error: error.code, message: error.message } };
  }
  return { status: 500, body: { error: "INTERNAL_ERROR", message: "Internal server error" } };
}

/**
 * Returns the (decoded) household id when the request is
 * `POST /households/<id>/fees` with a non-empty id, otherwise undefined.
 *
 * `req.url` is a path (plus query), so URL needs a base to parse it; the host
 * is a dummy and never used. Splitting the pathname beats a regex here: one
 * route, one shape, readable as a sentence.
 */
function matchRoute(req: IncomingMessage): string | undefined {
  if (req.method !== "POST") return undefined;
  const { pathname } = new URL(req.url ?? "/", "http://localhost");
  const segments = pathname.split("/"); // "/households/hh-1/fees" -> ["", "households", "hh-1", "fees"]
  if (segments.length !== 4 || segments[1] !== "households" || segments[3] !== "fees") return undefined;
  const rawId = segments[2]!;
  if (rawId === "") return undefined;
  return decodeURIComponent(rawId);
}

/**
 * "The request is malformed" - an HTTP fact, not a business one, so it is a
 * local class and not a DomainError: domain/errors.ts must not learn what
 * JSON is. It carries a `code` like the domain errors do, so the catch block
 * below treats both families the same way.
 */
class BadRequest extends Error {
  readonly code = "BAD_REQUEST";
}

/**
 * Collects the whole body as UTF-8 and parses it as JSON. The body is read
 * into memory without a size limit - fine for a teaching project on
 * localhost; adding a 413 for oversized bodies is left as an exercise.
 */
async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch (error) {
    throw new BadRequest(`Body is not valid JSON: ${(error as Error).message}`);
  }
}

/**
 * Shapes the parsed body into the port's command. Only the *shape* is
 * checked (an object with two strings) - whether "2026-02-30" is a date is
 * the use case's call, and its InvalidBillingPeriod is translated below like
 * any other domain error. The adapter does not know how to validate a date,
 * and it should not.
 */
function toCommand(householdId: string, body: unknown): CalculateHouseholdFeesCommand {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new BadRequest("Body must be a JSON object with string fields from and to");
  }
  const { from, to } = body as Record<string, unknown>;
  if (typeof from !== "string") throw new BadRequest("from must be a string (YYYY-MM-DD)");
  if (typeof to !== "string") throw new BadRequest("to must be a string (YYYY-MM-DD)");
  return { householdId, from, to };
}

/** Every response - success or failure - is JSON with the same content type. */
function respond(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}
