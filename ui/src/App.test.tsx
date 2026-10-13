// Smoke test for the shell (SUB-3.1.3.2): the page renders with nothing
// behind it and shows the project name and the subtitle.
import { test, expect } from "vitest";
import { screen } from "@testing-library/react";

import { App } from "./App";
import { renderWithQuery } from "./test/render";

test("renders the header", () => {
  renderWithQuery(<App />);
  expect(screen.getByRole("heading", { level: 1, name: "hexa-lab" })).toBeInTheDocument();
  expect(screen.getByText("Household fees")).toBeInTheDocument();
});
