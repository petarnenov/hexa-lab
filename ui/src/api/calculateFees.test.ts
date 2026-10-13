// Unit tests for the API client with fetch stubbed: the request shape and
// every way the server (or the lack of one) can answer.
import { test, expect, vi, afterEach } from "vitest";

import { calculateFees } from "./calculateFees";
import { ApiError } from "./ApiError";
import { hh1Report, jsonResponse, htmlResponse } from "../test/fixtures";

const q1 = { householdId: "hh-1", from: "2026-01-01", to: "2026-03-31" };

function stubFetch() {
  const fetchMock = vi.fn<typeof fetch>();
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => vi.unstubAllGlobals());

async function failure(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(ApiError);
    return error as ApiError;
  }
  throw new Error("expected calculateFees to reject");
}

test("POSTs the period as JSON to the household's fees route", async () => {
  const fetchMock = stubFetch().mockResolvedValueOnce(jsonResponse(200, hh1Report));

  const report = await calculateFees(q1);

  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [url, init] = fetchMock.mock.calls[0]!;
  expect(url).toBe("/households/hh-1/fees");
  expect(init?.method).toBe("POST");
  expect(new Headers(init?.headers).get("content-type")).toBe("application/json");
  expect(init?.body).toBe('{"from":"2026-01-01","to":"2026-03-31"}');
  expect(report).toEqual(hh1Report);
});

test("URL-encodes the household id", async () => {
  const fetchMock = stubFetch().mockResolvedValueOnce(jsonResponse(200, hh1Report));

  await calculateFees({ ...q1, householdId: "hh 1" });

  expect(fetchMock.mock.calls[0]![0]).toBe("/households/hh%201/fees");
});

test("404 becomes ApiError with the server's code and message", async () => {
  stubFetch().mockResolvedValueOnce(
    jsonResponse(404, { error: "HOUSEHOLD_NOT_FOUND", message: "Household not found: hh-404" }),
  );

  const error = await failure(calculateFees({ ...q1, householdId: "hh-404" }));

  expect(error.status).toBe(404);
  expect(error.code).toBe("HOUSEHOLD_NOT_FOUND");
  expect(error.message).toBe("Household not found: hh-404");
});

test("400 becomes ApiError INVALID_BILLING_PERIOD", async () => {
  const message = "from (2026-03-31) must not be after to (2026-01-01)";
  stubFetch().mockResolvedValueOnce(jsonResponse(400, { error: "INVALID_BILLING_PERIOD", message }));

  const error = await failure(calculateFees({ ...q1, from: "2026-03-31", to: "2026-01-01" }));

  expect(error.status).toBe(400);
  expect(error.code).toBe("INVALID_BILLING_PERIOD");
  expect(error.message).toBe(message);
});

test("500 becomes ApiError INTERNAL_ERROR", async () => {
  stubFetch().mockResolvedValueOnce(
    jsonResponse(500, { error: "INTERNAL_ERROR", message: "Internal server error" }),
  );

  const error = await failure(calculateFees(q1));

  expect(error.status).toBe(500);
  expect(error.code).toBe("INTERNAL_ERROR");
});

test("a non-JSON error body (proxy with the backend down) is NETWORK_ERROR", async () => {
  stubFetch().mockResolvedValueOnce(htmlResponse(502));

  const error = await failure(calculateFees(q1));

  expect(error.status).toBe(502);
  expect(error.code).toBe("NETWORK_ERROR");
  expect(error.message).not.toBe("");
  expect(error.message).not.toContain("<html>");
});

test("a rejected fetch is NETWORK_ERROR with status 0", async () => {
  stubFetch().mockRejectedValueOnce(new TypeError("Failed to fetch"));

  const error = await failure(calculateFees(q1));

  expect(error.status).toBe(0);
  expect(error.code).toBe("NETWORK_ERROR");
  expect(error.message).toContain("Failed to fetch");
});
