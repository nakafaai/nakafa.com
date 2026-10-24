import { createFileRoute } from "@tanstack/react-router";
import { methodNotAllowed } from "@/lib/routing/method";
import { runServerEffect } from "@/lib/server/fn";
import { serveSitemapPage } from "@/lib/sitemap/route.server";

/** One bounded sitemap page, named `<id>.xml`. */
export const Route = createFileRoute("/sitemap/$id")({
  server: {
    handlers: {
      ANY: methodNotAllowed("GET, HEAD"),
      GET: ({ params }) => runServerEffect(serveSitemapPage({ params })),
    },
  },
});
