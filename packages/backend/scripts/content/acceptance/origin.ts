import { acceptanceRuntimeError } from "@repo/backend/scripts/content/acceptance/error";
import { Config, Effect } from "effect";

/**
 * The origin that the served acceptance app listens on: localhost on the port
 * that `ACCEPTANCE_PORT` names, 3000 by default, so the runtimes of separate
 * checkouts can serve side by side. Prepare records it in the runtime manifest
 * and bakes it into the backend's `SITE_URL`, the build bakes it into the
 * browser client, and the browser suites open it. The host is localhost, not
 * 127.0.0.1: a local session cookie is set for localhost, and the browser never
 * sends it to 127.0.0.1.
 */
export const acceptanceOrigin = Config.Port("ACCEPTANCE_PORT").pipe(
  Config.withDefault(3000),
  Config.map((port) => `http://localhost:${port}`),
  Effect.mapError(() =>
    acceptanceRuntimeError("ACCEPTANCE_PORT must name a port from 1 to 65535.")
  )
);
