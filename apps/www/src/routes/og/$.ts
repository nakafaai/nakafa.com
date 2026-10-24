import { createFileRoute } from "@tanstack/react-router";
import { serveOgImage } from "@/lib/og/serve.server";
import { methodNotAllowed } from "@/lib/routing/method";
import { runServerEffect } from "@/lib/server/fn";

/** The social image of one route, with its locale prefix when it has one. */
export const Route = createFileRoute("/og/$")({
  server: {
    handlers: {
      ANY: methodNotAllowed("GET, HEAD"),
      GET: ({ params }) => runServerEffect(serveOgImage({ params })),
    },
  },
});
