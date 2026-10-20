import { createFileRoute } from "@tanstack/react-router";
import { serveLocalizedHref } from "@/lib/routing/locale/route.server";

/** The href of the selected locale for the current browser address. */
export const Route = createFileRoute("/api/internal/routing/locale")({
  server: { handlers: { GET: serveLocalizedHref } },
});
