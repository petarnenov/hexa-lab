// One config for Vite and Vitest. `defineConfig` comes from vitest/config so
// the `test` block is typed; a separate vitest.config.ts would only repeat
// the plugin list.
//
// The proxy is the whole integration with the backend: the page calls
// `/households/...` on its own origin, Vite forwards it to the HTTP adapter,
// and the adapter never learns about CORS or about the UI. PORT is read the
// same way http.main.ts reads it (`||`, so an empty PORT means "not set"),
// once at startup - restart `npm run ui` after changing it.
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

const backend = `http://localhost:${process.env.PORT || 3000}`;

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { "/households": backend },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
