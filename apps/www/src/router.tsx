import { createRouter } from "@tanstack/react-router";
import { routeRewrite } from "@/lib/routing/rewrite";
import { makeScrollRestoration } from "@/lib/routing/scroll";
import { routeTree } from "@/routeTree.gen";

/**
 * Keys a route's component by its params. A route keeps its component mounted
 * while only its params change, so keying it makes each page start fresh and
 * runs the unmount cleanups of its open menus and sheets on the move.
 */
function remountByParams({ params }: { readonly params: object }) {
  return params;
}

export function getRouter() {
  return createRouter({
    defaultPendingMinMs: 300,
    defaultPendingMs: 200,
    defaultPreload: "intent",
    defaultPreloadStaleTime: 30_000,
    defaultRemountDeps: remountByParams,
    rewrite: routeRewrite,
    routeTree,
    scrollRestoration: makeScrollRestoration(),
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
