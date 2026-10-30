import { createFileRoute } from "@tanstack/react-router";
import { serveConnectCallback } from "@/lib/connectors/callback.server";
import { methodNotAllowed } from "@/lib/routing/method";
import { runServerEffect } from "@/lib/server/fn";

/** The one callback of Google's consent screen for the connectors project (ADR 0015). */
export const Route = createFileRoute("/api/connectors/google/callback")({
  server: {
    handlers: {
      ANY: methodNotAllowed("GET"),
      GET: ({ request }) => runServerEffect(serveConnectCallback(request)),
    },
  },
});
