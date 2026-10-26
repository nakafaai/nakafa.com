import { createFileRoute } from "@tanstack/react-router";
import { forwardSchoolApiRequest } from "@/lib/tenant/api.server";

/**
 * The school REST API on a school host (ADR 0026, ADR 0029), forwarded to the Convex
 * site of the school's cell. Any other host answers not found.
 */
export const Route = createFileRoute("/api/v1/$")({
  server: {
    handlers: {
      GET: ({ request }) => forwardSchoolApiRequest(request),
      POST: ({ request }) => forwardSchoolApiRequest(request),
    },
  },
});
