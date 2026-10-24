import { createFileRoute, Outlet } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { readSignedInHintFn } from "@/lib/auth/hint.functions";

/**
 * The try-out subtree mounts the page's one Convex client only for a signed-in
 * hint. A visitor's catalog, sets and sections read the loader and server
 * functions, and each Convex leaf islands itself. A learner's running attempt
 * renders its player on the server, which needs the client during that render, so
 * the server decides from the hint cookie and the first HTML and the client agree.
 */
export const Route = createFileRoute("/$locale/_main/try-out")({
  // The hint changes only with a full document visit, so a navigation between
  // try-out pages reads it once rather than on every change of page.
  staleTime: Number.POSITIVE_INFINITY,
  loader: () => readSignedInHintFn(),
  component: TryoutLayout,
});

/** The provider loads with a signed-in hint only, so a visitor's page never loads the client module. */
const RouteConvexProvider = lazy(() =>
  import("@/components/providers/route").then(({ RouteConvexProvider }) => ({
    default: RouteConvexProvider,
  }))
);

/** Mounts the one client that a signed-in learner's try-out pages read. */
function TryoutLayout() {
  const signedIn = Route.useLoaderData();
  if (!signedIn) {
    return <Outlet />;
  }
  return (
    <Suspense fallback={null}>
      <RouteConvexProvider>
        <Outlet />
      </RouteConvexProvider>
    </Suspense>
  );
}
