import { createFileRoute } from "@tanstack/react-router";
import { readProtectedResource } from "@/lib/agent/discovery";
import { methodNotAllowed } from "@/lib/routing/method";

/** The MCP server's metadata at the host's root, for a client that does not add the path (RFC 9728). */
export const Route = createFileRoute("/.well-known/oauth-protected-resource")({
  server: {
    handlers: {
      ANY: methodNotAllowed("GET, HEAD"),
      GET: ({ request }) => Response.json(readProtectedResource(request)),
    },
  },
});
