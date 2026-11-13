import { createFileRoute } from "@tanstack/react-router";

/** Convex Auth's refresh route: renews the session from its refresh cookie. */
export const Route = createFileRoute("/api/auth/refresh")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const [{ readAuthRoutes }, { runServerEffect }] = await Promise.all([
          import("@/lib/auth/server.server"),
          import("@/lib/server/fn"),
        ]);
        const routes = await runServerEffect(readAuthRoutes());
        return routes.refreshHandler(request);
      },
    },
  },
});
