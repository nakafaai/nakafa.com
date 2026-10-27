import { createFileRoute, Outlet } from "@tanstack/react-router";
import { createIsomorphicFn } from "@tanstack/react-start";
import { lazy, Suspense } from "react";
import { hasSignedInHint } from "@/lib/auth/hint";

/**
 * How the visit reads the try-out pages, decided where the route runs: whether the
 * visitor carries the signed-in hint (the request's cookies on the server, the
 * document's cookies in the browser, so a navigation into the try-out pages waits
 * on no server request; the hint cookie is not HttpOnly for this reason), and
 * whether the server answers the build's prerender, whose answer serves every
 * visitor of a static page.
 */
const readVisit = createIsomorphicFn()
  .server(async () => {
    const [{ readRequestSignedInHint }, { isPrerenderRequest }] =
      await Promise.all([
        import("@/lib/auth/hint.server"),
        import("@/lib/static/record.server"),
      ]);
    return {
      prerendered: isPrerenderRequest(),
      signedIn: readRequestSignedInHint(),
    };
  })
  .client(() =>
    Promise.resolve({
      prerendered: false,
      signedIn: hasSignedInHint(document.cookie),
    })
  );

/**
 * The try-out subtree mounts the page's one Convex client only for a signed-in
 * hint. A visitor's catalog, sets and sections read the loader and server
 * functions, and each Convex leaf islands itself. A learner's running attempt
 * renders its player on the server, which needs the client during that render, so
 * the server decides from the hint cookie and the first HTML and the client agree.
 *
 * The hint is route context, read before every navigation. Every catalog page,
 * track, set and section is prerendered, so the context that its HTML carries is
 * the build's, which no visitor's cookie decided. A track, a set and a section read
 * the learner's answer again once they have hydrated (`TryoutLearnerAnswer`), and a
 * learner who opens a catalog page and presses into a running attempt gets the
 * client there. A loader would not do: the router shows a stale loader answer at
 * once and reads it again in the background, after the attempt has already
 * rendered without the client, while `beforeLoad` runs on every navigation before
 * the page renders.
 */
export const Route = createFileRoute("/$locale/_main/try-out")({
  beforeLoad: () => readVisit(),
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
