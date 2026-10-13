// End-to-end tests through the components with fetch stubbed: what the
// user sees and what the server receives. The API client has its own unit
// tests (api/calculateFees.test.ts); here it is driven through the form.
import { test, expect, vi, afterEach } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { App } from "./App";
import { renderWithQuery } from "./test/render";
import { hh1Report, jsonResponse } from "./test/fixtures";

function stubFetch() {
  const fetchMock = vi.fn<typeof fetch>();
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => vi.unstubAllGlobals());

function fields() {
  return {
    household: screen.getByLabelText("Household") as HTMLInputElement,
    from: screen.getByLabelText("From") as HTMLInputElement,
    to: screen.getByLabelText("To") as HTMLInputElement,
    button: screen.getByRole("button", { name: "Calculate" }) as HTMLButtonElement,
  };
}

// --- shell (SUB-3.1.3.2) ---------------------------------------------------

test("renders the header", () => {
  renderWithQuery(<App />);
  expect(screen.getByRole("heading", { level: 1, name: "hexa-lab" })).toBeInTheDocument();
  expect(screen.getByText("Household fees")).toBeInTheDocument();
});

// --- form (TASK-3.2.2) -------------------------------------------------------

test("the form has three labelled fields with defaults and a Calculate button", () => {
  renderWithQuery(<App />);
  const f = fields();
  expect(f.household.value).toBe("hh-1");
  expect(f.from.value).toBe("2026-01-01");
  expect(f.to.value).toBe("2026-03-31");
  expect(f.button).toBeEnabled();
});

test("clicking Calculate sends exactly the field values", async () => {
  const fetchMock = stubFetch().mockResolvedValueOnce(jsonResponse(200, hh1Report));
  const user = userEvent.setup();
  renderWithQuery(<App />);

  await user.clear(fields().household);
  await user.type(fields().household, "hh-2");
  await user.click(fields().button);

  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [url, init] = fetchMock.mock.calls[0]!;
  expect(url).toBe("/households/hh-2/fees");
  expect(init?.body).toBe('{"from":"2026-01-01","to":"2026-03-31"}');
});

test("Enter in a field submits once", async () => {
  const fetchMock = stubFetch().mockResolvedValueOnce(jsonResponse(200, hh1Report));
  const user = userEvent.setup();
  renderWithQuery(<App />);

  await user.click(fields().household);
  await user.keyboard("{Enter}");

  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock.mock.calls[0]![0]).toBe("/households/hh-1/fees");
});

test("the button is disabled while the request is pending and a second click does nothing", async () => {
  let resolve!: (r: Response) => void;
  const fetchMock = stubFetch().mockReturnValueOnce(new Promise<Response>((r) => (resolve = r)));
  const user = userEvent.setup();
  renderWithQuery(<App />);

  await user.click(fields().button);
  expect(fields().button).toBeDisabled();
  await user.click(fields().button);
  expect(fetchMock).toHaveBeenCalledTimes(1);

  resolve(jsonResponse(200, hh1Report));
  await waitFor(() => expect(fields().button).toBeEnabled());
});

// --- report (TASK-3.2.3, SUB-3.2.4.1) -----------------------------------------

test("happy path: submit with defaults shows the three lines and the total", async () => {
  const fetchMock = stubFetch().mockResolvedValueOnce(jsonResponse(200, hh1Report));
  const user = userEvent.setup();
  renderWithQuery(<App />);

  await user.click(fields().button);

  expect(fetchMock.mock.calls[0]![0]).toBe("/households/hh-1/fees");
  expect(fetchMock.mock.calls[0]![1]?.body).toBe('{"from":"2026-01-01","to":"2026-03-31"}');

  const table = await screen.findByRole("table");
  const rows = within(table.querySelector("tbody")!).getAllByRole("row");
  expect(rows.map((r) => r.querySelector("td")!.textContent)).toEqual(["Alpha", "Beta", "Gamma"]);
  expect(rows.map((r) => r.querySelectorAll("td")[2]!.textContent)).toEqual(["standard", "standard", "premium"]);
  expect(within(rows[0]!).getByText("2,500,000.00")).toBeInTheDocument();
  expect(within(rows[0]!).getByText("5,239.73")).toBeInTheDocument();

  expect(table.querySelector("caption")).toHaveTextContent("hh-1 · 2026-01-01 → 2026-03-31");
  const foot = table.querySelector("tfoot")!;
  expect(within(foot).getByText("Total")).toBeInTheDocument();
  expect(within(foot).getByText("14,239.73")).toBeInTheDocument();

  expect(screen.queryByText("Pick a household and a period.")).not.toBeInTheDocument();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

test("the total comes from the server, not from summing the lines", async () => {
  stubFetch().mockResolvedValueOnce(
    jsonResponse(200, { ...hh1Report, lines: [{ ...hh1Report.lines[0]!, fee: 1 }], total: 2 }),
  );
  const user = userEvent.setup();
  renderWithQuery(<App />);

  await user.click(fields().button);

  const foot = (await screen.findByRole("table")).querySelector("tfoot")!;
  expect(within(foot).getByText("2.00")).toBeInTheDocument();
});

test("a report without lines shows only the header and a zero total", async () => {
  stubFetch().mockResolvedValueOnce(jsonResponse(200, { ...hh1Report, lines: [], total: 0 }));
  const user = userEvent.setup();
  renderWithQuery(<App />);

  await user.click(fields().button);

  const table = await screen.findByRole("table");
  expect(table.querySelectorAll("tbody tr")).toHaveLength(0);
  expect(within(table.querySelector("tfoot")!).getByText("0.00")).toBeInTheDocument();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

// --- states (SUB-3.2.3.3) ------------------------------------------------------

test("idle: a quiet hint, no table, no alert", () => {
  renderWithQuery(<App />);
  expect(screen.getByText("Pick a household and a period.")).toBeInTheDocument();
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

test("loading: Calculating… in an aria-busy element", async () => {
  stubFetch().mockReturnValueOnce(new Promise<Response>(() => {}));
  const user = userEvent.setup();
  renderWithQuery(<App />);

  await user.click(fields().button);

  const busy = await screen.findByText("Calculating…");
  expect(busy).toHaveAttribute("aria-busy", "true");
  expect(screen.queryByText("Pick a household and a period.")).not.toBeInTheDocument();
});

test("error: hh-404 shows an alert with the code and the message, no table", async () => {
  stubFetch().mockResolvedValueOnce(
    jsonResponse(404, { error: "HOUSEHOLD_NOT_FOUND", message: "Household not found: hh-404" }),
  );
  const user = userEvent.setup();
  renderWithQuery(<App />);

  await user.clear(fields().household);
  await user.type(fields().household, "hh-404");
  await user.click(fields().button);

  const alert = await screen.findByRole("alert");
  expect(within(alert).getByText("HOUSEHOLD_NOT_FOUND")).toBeInTheDocument();
  expect(within(alert).getByText("Household not found: hh-404")).toBeInTheDocument();
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
  expect(fields().button).toBeEnabled();
});

// --- server errors (SUB-3.2.4.2) ----------------------------------------------

test("error: 400 INVALID_BILLING_PERIOD shows the code and the server's message", async () => {
  const message = "from (2026-03-31) must not be after to (2026-01-01)";
  stubFetch().mockResolvedValueOnce(jsonResponse(400, { error: "INVALID_BILLING_PERIOD", message }));
  const user = userEvent.setup();
  renderWithQuery(<App />);

  await user.click(fields().button);

  const alert = await screen.findByRole("alert");
  expect(within(alert).getByText("INVALID_BILLING_PERIOD")).toBeInTheDocument();
  expect(within(alert).getByText(message)).toBeInTheDocument();
  expect(fields().button).toBeEnabled();
});

test("error: a rejected fetch shows NETWORK_ERROR without crashing", async () => {
  stubFetch().mockRejectedValueOnce(new TypeError("Failed to fetch"));
  const user = userEvent.setup();
  renderWithQuery(<App />);

  await user.click(fields().button);

  const alert = await screen.findByRole("alert");
  expect(within(alert).getByText("NETWORK_ERROR")).toBeInTheDocument();
  expect(within(alert).getByText(/Failed to fetch/)).toBeInTheDocument();
  expect(fields().button).toBeEnabled();
});

test("a new submit clears the previous error", async () => {
  stubFetch()
    .mockResolvedValueOnce(
      jsonResponse(404, { error: "HOUSEHOLD_NOT_FOUND", message: "Household not found: hh-404" }),
    )
    .mockResolvedValueOnce(jsonResponse(200, hh1Report));
  const user = userEvent.setup();
  renderWithQuery(<App />);

  await user.click(fields().button);
  await screen.findByRole("alert");

  await user.click(fields().button);

  await screen.findByRole("table");
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});
