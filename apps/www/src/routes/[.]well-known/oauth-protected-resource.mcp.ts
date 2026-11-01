import { createFileRoute } from "@tanstack/react-router";
import { readProtectedResource } from "@/lib/agent/discovery";
import { methodNotAllowed } from "@/lib/routing/method";

/** The MCP server's metadata at the path that the challenge of a refused request names (RFC 9728). */
export const Route = createFileRoute(
  "/.well-known/oauth-protected-resource/mcp"
)({
  server: {
    handlers: {
      ANY: methodNotAllowed("GET, HEAD"),
      GET: ({ request }) => Response.json(readProtectedResource(request)),
    },
  },
});
