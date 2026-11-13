import { createFileRoute } from "@tanstack/react-router";

/** Convex Auth's sign-in route: forwards a sign-in function and keeps its refresh token in a cookie. */
export const Route = createFileRoute("/api/auth/signin")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const [{ readAuthRoutes }, { runServerEffect }] = await Promise.all([
          import("@/lib/auth/server.server"),
          import("@/lib/server/fn"),
        ]);
        const routes = await runServerEffect(readAuthRoutes());
        return routes.convexProxyHandler(request);
      },
    },
  },
});
