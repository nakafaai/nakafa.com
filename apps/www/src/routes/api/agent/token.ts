import { createFileRoute } from "@tanstack/react-router";

/** The agent OAuth endpoint that trades a code or a refresh token for an agent's tokens (ADR 0029). */
export const Route = createFileRoute("/api/agent/token")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const [{ issueAgentTokens }, { runServerEffect }] = await Promise.all([
          import("@/lib/agent/oauth.server"),
          import("@/lib/server/fn"),
        ]);
        return runServerEffect(issueAgentTokens(request));
      },
    },
  },
});
