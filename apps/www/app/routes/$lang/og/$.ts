import { createFileRoute } from "@tanstack/react-router";
import { serveLocaleOgImage } from "@/lib/og/serve.server";
import { methodNotAllowed } from "@/lib/routing/method";

/**
 * The social image of one localized route. The parameter is not `$locale`: the
 * locale route's parser throws the router's not-found, which a server route
 * answers as an error, so this route checks its locale itself.
 */
export const Route = createFileRoute("/$lang/og/$")({
  server: {
    handlers: { ANY: methodNotAllowed("GET, HEAD"), GET: serveLocaleOgImage },
  },
});
