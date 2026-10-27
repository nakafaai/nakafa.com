import { createFileRoute, Outlet } from "@tanstack/react-router";
import { createIsomorphicFn } from "@tanstack/react-start";
import { lazy, Suspense } from "react";
import { hasSignedInHint } from "@/lib/auth/hint";

/**
 * Whether the visitor carries the signed-in hint, read where the route runs: the
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
 *
 * The hint is route context, read before every navigation. The catalog's pages,
 * and a visitor's tracks, sets and sections, are prerendered, so the answer that
 * their HTML carries is the build's, which no visitor's cookie decided, and a
 * learner who opens one and presses into a running attempt needs the client there.
 * A learner's own track, set or section renders on the Worker for their request
 * (`isLearnerPage`), so its first HTML is theirs. A loader would not do: the router
 * shows a stale loader answer at once and reads it again in the background, after
 * the attempt has already rendered without the client, while `beforeLoad` runs on
 * every navigation before the page renders.
 */
export const Route = createFileRoute("/$locale/_main/try-out")({
  beforeLoad: async () => ({ signedIn: await readSignedInHint() }),
  component: TryoutLayout,
});

/** The provider loads with a signed-in hint only, so a visitor's page never loads the client module. */
const RouteConvexProvider = lazy(() =>
  import("@/components/providers/route").then(({ RouteConvexProvider }) => ({
    default: RouteConvexProvider,
  }))
);

/**
 * Mounts the one client that a signed-in learner's try-out pages read. The
 * boundary stands for a visitor too, so when a navigation finds the hint and the
 * provider's module loads, the router's transition keeps the page that is on
 * screen instead of showing an empty frame.
 */
function TryoutLayout() {
  const signedIn = Route.useRouteContext({
    select: (context) => context.signedIn,
  });
  return (
    <Suspense fallback={null}>
      {signedIn ? (
        <RouteConvexProvider>
          <Outlet />
        </RouteConvexProvider>
      ) : (
        <Outlet />
      )}
    </Suspense>
  );
}
