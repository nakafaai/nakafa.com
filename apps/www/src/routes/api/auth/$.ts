import { createFileRoute } from "@tanstack/react-router";
import { forwardAuthRequest } from "@/lib/auth/forward.server";

/** Better Auth, served from this site, so every cookie it sets belongs to this host. */
export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: ({ request }) => forwardAuthRequest(request),
      POST: ({ request }) => forwardAuthRequest(request),
    },
  },
});
