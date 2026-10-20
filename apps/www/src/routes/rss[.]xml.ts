import { createFileRoute } from "@tanstack/react-router";
import { methodNotAllowed } from "@/lib/routing/method";
import { serveRssFeed } from "@/lib/seo/feed.server";

/** The feed of the latest signed articles and materials. */
export const Route = createFileRoute("/rss.xml")({
  server: {
    handlers: { ANY: methodNotAllowed("GET, HEAD"), GET: serveRssFeed },
  },
});
