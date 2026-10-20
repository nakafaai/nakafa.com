import { createFileRoute } from "@tanstack/react-router";
import { serveOgImage } from "@/lib/og/serve.server";

/** The social image of one route, with its locale prefix when it has one. */
export const Route = createFileRoute("/og/$")({
  server: { handlers: { GET: serveOgImage } },
});
