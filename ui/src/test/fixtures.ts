// Test fixtures shared by the API client and the App tests.
//
// hh1Report is the README's curl output for hh-1, Q1 2026, copied by hand:
// a test that parsed README.md would tie the UI tests to markdown. If the
// README changes, change this too.
//
// The response helpers build real `Response` objects (global in Node 24,
// kept by Vitest's jsdom environment) so the client's body reading and
// `ok` logic run against the same API the browser gives it.
import type { FeeReport } from "../api/types";

export const hh1Report: FeeReport = {
  householdId: "hh-1",
  period: { from: "2026-01-01", to: "2026-03-31" },
  lines: [
    { accountId: "acc-1", accountName: "Alpha", aum: 2500000, feeScheduleId: "standard", fee: 5239.73 },
    { accountId: "acc-2", accountName: "Beta", aum: 150000, feeScheduleId: "standard", fee: 616.44 },
    { accountId: "acc-3", accountName: "Gamma", aum: 4000000, feeScheduleId: "premium", fee: 8383.56 },
  ],
  total: 14239.73,
};

export function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

/** What the Vite proxy sends back when the backend is down: not JSON. */
export function htmlResponse(status: number): Response {
  return new Response("<html><body>Bad Gateway</body></html>", {
    status,
    headers: { "content-type": "text/html" },
  });
}
