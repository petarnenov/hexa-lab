// Browser entry point (index.html loads it as a module).
//
// One QueryClient for the whole page, created here - the composition root
// of the UI, the same way bootstrap/ is the composition root of the server.
// StrictMode double-invokes effects in dev so sloppy effects show up early.
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { App } from "./App";
import "./styles.css";

const queryClient = new QueryClient();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
