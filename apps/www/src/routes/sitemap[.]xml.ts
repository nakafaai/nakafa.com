import { createFileRoute } from "@tanstack/react-router";
import { methodNotAllowed } from "@/lib/routing/method";
import { runServerEffect } from "@/lib/server/fn";
import { serveSitemapIndex } from "@/lib/sitemap/route.server";

/** The sitemap index that points at the bounded sitemap pages. */
export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      ANY: methodNotAllowed("GET, HEAD"),
      GET: () => runServerEffect(serveSitemapIndex()),
    },
  },
});
