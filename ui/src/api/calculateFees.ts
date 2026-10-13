// calculateFees - the UI's one call to the server.
//
// This file is the only place in ui/ that knows about fetch, URLs and HTTP
// statuses; components get a function and a FeeReport (or an ApiError).
// The path is relative on purpose: the page calls its own origin and the
// Vite dev server proxies /households to the HTTP adapter.
import { ApiError } from "./ApiError";
import type { FeeReport, FeeRequest } from "./types";

export async function calculateFees({ householdId, from, to }: FeeRequest): Promise<FeeReport> {
  let response: Response;
  try {
    response = await fetch(`/households/${encodeURIComponent(householdId)}/fees`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ from, to }),
    });
  } catch (error) {
    // No response at all: DNS, connection refused, proxy down, offline.
    throw new ApiError(0, "NETWORK_ERROR", `Network error: ${(error as Error).message}`);
  }

  if (response.ok) {
    return (await response.json()) as FeeReport;
  }
  throw await toApiError(response);
}

// Read the body once as text and try to parse it: with `response.json()` an
// HTML page from the proxy would throw a SyntaxError after the body is
// already consumed, so the fallback could not read it either.
async function toApiError(response: Response): Promise<ApiError> {
  const text = await response.text();
  const body = parseErrorBody(text);
  if (body) {
    return new ApiError(response.status, body.error, body.message);
  }
  return new ApiError(
    response.status,
    "NETWORK_ERROR",
    `Server returned ${response.status} without a JSON error body`,
  );
}

function parseErrorBody(text: string): { error: string; message: string } | undefined {
  try {
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed === "object" && parsed !== null && "error" in parsed && typeof parsed.error === "string") {
      const message = "message" in parsed && typeof parsed.message === "string" ? parsed.message : parsed.error;
      return { error: parsed.error, message };
    }
  } catch {
    // not JSON
  }
  return undefined;
}
