import { createFileRoute } from "@tanstack/react-router";
import { methodNotAllowed } from "@/lib/routing/method";
import { serveManifest } from "@/lib/seo/manifest.server";
import { runServerEffect } from "@/lib/server/fn";

/** The web app manifest of the installable app. */
export const Route = createFileRoute("/manifest.webmanifest")({
  server: {
    handlers: {
      ANY: methodNotAllowed("GET, HEAD"),
      GET: () => runServerEffect(serveManifest()),
    },
  },
});
