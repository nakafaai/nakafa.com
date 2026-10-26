import { createFileRoute } from "@tanstack/react-router";
import { forwardSchoolApiRequest } from "@/lib/tenant/api.server";

/**
 * The school MCP server on a school host (ADR 0026, ADR 0029), forwarded to the Convex site
 * of the school's cell, where the bearer token is checked. Any other host answers not found.
 */
export const Route = createFileRoute("/mcp")({
  server: {
    handlers: {
      GET: ({ request }) => forwardSchoolApiRequest(request),
      OPTIONS: ({ request }) => forwardSchoolApiRequest(request),
      POST: ({ request }) => forwardSchoolApiRequest(request),
    },
  },
});
