import { createFileRoute } from "@tanstack/react-router";
import { serveContentRenderer } from "@/lib/content/internal/renderer.server";
import { methodNotAllowed } from "@/lib/routing/method";
import { runServerEffect } from "@/lib/server/fn";

/** The renderer manifest that Aksara checks, and its preview proof. */
export const Route = createFileRoute("/api/internal/content/renderer")({
  server: {
    handlers: {
      ANY: methodNotAllowed("GET, HEAD"),
      GET: ({ request }) => runServerEffect(serveContentRenderer({ request })),
    },
  },
});
