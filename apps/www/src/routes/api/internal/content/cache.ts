import { createFileRoute } from "@tanstack/react-router";
import { receiveContentCache } from "@/lib/content/internal/cache.server";
import { methodNotAllowed } from "@/lib/routing/method";
import { runServerEffect } from "@/lib/server/fn";

/** The release receiver of Aksara: the publisher posts one activated release here. */
export const Route = createFileRoute("/api/internal/content/cache")({
  server: {
    handlers: {
      ANY: methodNotAllowed("POST"),
      POST: ({ request }) => runServerEffect(receiveContentCache(request)),
    },
  },
});
