import { HTTP_OK } from "@repo/backend/confect/modules/operations/http.constants";
import { Clock, Effect } from "effect";
import { Hono } from "hono";

/** Public API v1 metadata and health routes. */
export const v1Routes = new Hono();

v1Routes.get("/", (context) =>
  context.json(
    {
      version: "1.0.0",
      status: "active",
      docs: "https://docs.nakafa.com/api",
    },
    HTTP_OK
  )
);

v1Routes.get("/health", async (context) =>
  context.json(
    {
      status: "ok",
      timestamp: await Effect.runPromise(Clock.currentTimeMillis),
    },
    HTTP_OK
  )
);
