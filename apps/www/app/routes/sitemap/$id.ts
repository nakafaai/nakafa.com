import { createFileRoute } from "@tanstack/react-router";
import { methodNotAllowed } from "@/lib/routing/method";
import { serveSitemapPage } from "@/lib/sitemap/route.server";

/** One bounded sitemap page, named `<id>.xml`. */
export const Route = createFileRoute("/sitemap/$id")({
  server: {
    handlers: { ANY: methodNotAllowed("GET, HEAD"), GET: serveSitemapPage },
  },
});
