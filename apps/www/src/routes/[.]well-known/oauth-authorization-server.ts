import { createFileRoute } from "@tanstack/react-router";
import { readAuthorizationServer } from "@/lib/agent/discovery";
import { methodNotAllowed } from "@/lib/routing/method";

/** Where an agent registers and signs its person in (RFC 8414). */
export const Route = createFileRoute("/.well-known/oauth-authorization-server")(
  {
    server: {
      handlers: {
        ANY: methodNotAllowed("GET, HEAD"),
        GET: ({ request }) => Response.json(readAuthorizationServer(request)),
      },
    },
  }
);
