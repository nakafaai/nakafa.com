import { createFileRoute, Outlet } from "@tanstack/react-router";
import { createIsomorphicFn } from "@tanstack/react-start";
import { lazy, Suspense } from "react";
import { hasSignedInHint } from "@/lib/auth/hint";

/**
 * Whether the visitor carries the signed-in hint, read where the loader runs: the
 * request's cookies on the server, and the document's cookies in the browser, so a
 * navigation into the try-out pages waits on no server request. The hint cookie is
 * not HttpOnly for this reason.
 */
const readSignedInHint = createIsomorphicFn()
  .server(async () => {
    const { readRequestSignedInHint } = await import("@/lib/auth/hint.server");
    return readRequestSignedInHint();
  })
  .client(() => Promise.resolve(hasSignedInHint(document.cookie)));

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
  loader: () => readSignedInHint(),
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
