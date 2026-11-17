import { createFileRoute } from "@tanstack/react-router";

/** Convex Auth's sign-out route: ends the session and clears its cookies. */
export const Route = createFileRoute("/api/auth/signout")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const [{ readAuthRoutes }, { runServerEffect }] = await Promise.all([
          import("@/lib/auth/server.server"),
          import("@/lib/server/fn"),
        ]);
        const routes = await runServerEffect(readAuthRoutes());
        return routes.signOutHandler(request);
      },
    },
  },
});
