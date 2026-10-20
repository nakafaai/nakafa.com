import { createFileRoute, Outlet } from "@tanstack/react-router";
import { ConvexProvider } from "convex/react";
import { clientEnv } from "@/env.public";
import { readConvexClient } from "@/lib/convex/client";

/**
 * The try-out subtree reads Convex on entry: its catalog, sets and attempts are
 * live queries and mutations, and the subtree mounts the page's one client here.
 * A visitor who opens it gets that client, which decision 13 does not allow on
 * a public page. Islanding each try-out leaf is the open follow-up.
 */
export const Route = createFileRoute("/$locale/_main/try-out")({
  component: TryoutLayout,
});

/** Mounts the one client that the try-out pages read. */
function TryoutLayout() {
  return (
    <ConvexProvider client={readConvexClient(clientEnv.VITE_CONVEX_URL)}>
      <Outlet />
    </ConvexProvider>
  );
}
