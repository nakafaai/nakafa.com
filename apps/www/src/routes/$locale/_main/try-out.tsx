import { createFileRoute, Outlet } from "@tanstack/react-router";
import { ConvexProvider } from "convex/react";
import { clientEnv } from "@/env.public";
import { readSignedInHintFn } from "@/lib/auth/hint.functions";
import { readConvexClient } from "@/lib/convex/client";

/**
 * The try-out subtree mounts the page's one Convex client only for a signed-in
 * hint. A visitor's catalog, sets and sections read the loader and server
 * functions, and each Convex leaf islands itself. A learner's running attempt
 * renders its player on the server, which needs the client during that render, so
 * the server decides from the hint cookie and the first HTML and the client agree.
 */
export const Route = createFileRoute("/$locale/_main/try-out")({
  loader: () => readSignedInHintFn(),
  component: TryoutLayout,
});

/** Mounts the one client that a signed-in learner's try-out pages read. */
function TryoutLayout() {
  const signedIn = Route.useLoaderData();
  if (!signedIn) {
    return <Outlet />;
  }
  return (
    <ConvexProvider client={readConvexClient(clientEnv.VITE_CONVEX_URL)}>
      <Outlet />
    </ConvexProvider>
  );
}
