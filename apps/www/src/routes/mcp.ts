import { createFileRoute } from "@tanstack/react-router";
import { forwardSchoolApiRequest } from "@/lib/tenant/api.server";

/**
 * The MCP server on a school host and on the main site (ADR 0026, ADR 0029), forwarded to the
 * Convex site of the cell, where the bearer token is checked.
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
