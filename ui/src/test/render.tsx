// renderWithQuery - render a component inside a fresh QueryClientProvider.
//
// A new QueryClient per render: no cache shared between tests, and
// `retry: false` so a failing request fails at once instead of retrying
// three times with back-off while the test waits.
import type { ReactElement } from "react";
import { render, type RenderResult } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

export function renderWithQuery(ui: ReactElement): RenderResult {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}
