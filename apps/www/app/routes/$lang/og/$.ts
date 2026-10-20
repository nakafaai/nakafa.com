import { createFileRoute } from "@tanstack/react-router";
import { serveLocaleOgImage } from "@/lib/og/serve.server";

/**
 * The social image of one localized route. The parameter is not `$locale`: the
 * locale route's parser throws the router's not-found, which a server route
 * answers as an error, so this route checks its locale itself.
 */
export const Route = createFileRoute("/$lang/og/$")({
  server: { handlers: { GET: serveLocaleOgImage } },
});
