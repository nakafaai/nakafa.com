import { createFileRoute } from "@tanstack/react-router";
import { serveManifest } from "@/lib/seo/manifest.server";

/** The web app manifest of the installable app. */
export const Route = createFileRoute("/manifest.webmanifest")({
  server: { handlers: { GET: serveManifest } },
});
