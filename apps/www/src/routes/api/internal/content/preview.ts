import { createFileRoute } from "@tanstack/react-router";
import { serveContentPreview } from "@/lib/content/internal/preview.server";
import { methodNotAllowed } from "@/lib/routing/method";
import { runServerEffect } from "@/lib/server/fn";

/** The event stream of the local Aksara preview child. */
export const Route = createFileRoute("/api/internal/content/preview")({
  server: {
    handlers: {
      ANY: methodNotAllowed("GET, HEAD"),
      GET: ({ request }) => runServerEffect(serveContentPreview({ request })),
    },
  },
});
