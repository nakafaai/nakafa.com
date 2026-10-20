import { createRouter } from "@tanstack/react-router";
import { routeTree } from "@/app/routeTree.gen";
import { routeRewrite } from "@/lib/routing/rewrite";

export function getRouter() {
  return createRouter({
    defaultPendingMinMs: 300,
    defaultPendingMs: 200,
    defaultPreload: "intent",
    defaultPreloadStaleTime: 30_000,
    rewrite: routeRewrite,
    routeTree,
    scrollRestoration: true,
  });
}

/**
 * Registers the router's type with TanStack Router, so every link, route and
 * loader reads the one route tree. The app renders on the server, so loader
 * results are checked for serialization.
 */
declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
    ssr: true;
  }
}
