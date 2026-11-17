import { createFileRoute } from "@tanstack/react-router";

/** The agent OAuth endpoint that registers an agent (RFC 7591) (ADR 0029). */
export const Route = createFileRoute("/api/agent/register")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const [{ registerAgent }, { runServerEffect }] = await Promise.all([
          import("@/lib/agent/oauth.server"),
          import("@/lib/server/fn"),
        ]);
        return runServerEffect(registerAgent(request));
      },
    },
  },
});
