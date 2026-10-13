// Vitest setup (vite.config.ts -> test.setupFiles). Side effects only:
// jest-dom's matchers on `expect` (toBeInTheDocument, ...) and a DOM
// cleanup after each test so one test's render never leaks into the next.
import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(cleanup);
