import { createFileRoute } from "@tanstack/react-router";
import { serveContentPreview } from "@/lib/content/internal/preview.server";

/** The event stream of the local Aksara preview child. */
export const Route = createFileRoute("/api/internal/content/preview")({
  server: { handlers: { GET: serveContentPreview } },
});
