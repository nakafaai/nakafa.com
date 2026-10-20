import { createFileRoute } from "@tanstack/react-router";
import { serveSitemapIndex } from "@/lib/sitemap/route.server";

/** The sitemap index that points at the bounded sitemap pages. */
export const Route = createFileRoute("/sitemap.xml")({
  server: { handlers: { GET: serveSitemapIndex } },
});
