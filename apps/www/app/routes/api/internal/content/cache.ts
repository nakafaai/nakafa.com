import { createFileRoute } from "@tanstack/react-router";
import { receiveContentCache } from "@/lib/content/internal/cache.server";

/** The release receiver of Aksara: the publisher posts one activated release here. */
export const Route = createFileRoute("/api/internal/content/cache")({
  server: { handlers: { POST: receiveContentCache } },
});
