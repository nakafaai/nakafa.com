import { createFileRoute } from "@tanstack/react-router";
import { serveContentRenderer } from "@/lib/content/internal/renderer.server";

/** The renderer manifest that Aksara checks, and its preview proof. */
export const Route = createFileRoute("/api/internal/content/renderer")({
  server: { handlers: { GET: serveContentRenderer } },
});
