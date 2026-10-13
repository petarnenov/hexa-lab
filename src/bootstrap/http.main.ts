// http.main - the process entry point behind `npm run http`.
//
// Compose the use case, wrap it in the HTTP adapter, listen. The adapter
// returns a server that does not listen (createHttpServer.ts) precisely so
// that the port is decided here, by the process, and nowhere else.
//
// `PORT` defaults to 3000; `||` so that `PORT=` (empty) means "not set".
// `Number(...)` without further validation: `PORT=abc` is NaN and `listen`
// throws Node's own ERR_SOCKET_BAD_PORT, which is clear enough.
//
// The log line reports the port from `server.address()`, not from `port`:
// with `PORT=0` the OS picks an ephemeral port and only the server knows it
// (the test relies on this). stderr, not stdout - stdout is for data, as the
// CLI convention goes. The cast is safe: for a TCP server `address()` is an
// AddressInfo once `listening` has fired.
//
// A bad `STORAGE` makes `composeApp` throw before anything listens; it is
// left unhandled, like in cli.main.ts: message first, stack, exit 1.
//
// No signal handling or graceful shutdown: Ctrl-C ends the process, and the
// kernel closes the socket. Nothing is exported - a main is run, not imported.

import type { AddressInfo } from "node:net";

import { createHttpServer } from "../adapters/in/createHttpServer.ts";
import { composeApp } from "./compose.ts";

const port = Number(process.env.PORT || 3000);

const server = createHttpServer(composeApp()).listen(port, () => {
  const { port: actual } = server.address() as AddressInfo;
  process.stderr.write(`[bootstrap] listening on http://localhost:${actual}\n`);
});
