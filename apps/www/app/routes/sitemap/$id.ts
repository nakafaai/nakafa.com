import { createFileRoute } from "@tanstack/react-router";
import { serveSitemapPage } from "@/lib/sitemap/route.server";

/** One bounded sitemap page, named `<id>.xml`. */
export const Route = createFileRoute("/sitemap/$id")({
  server: { handlers: { GET: serveSitemapPage } },
});
