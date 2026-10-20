import { createFileRoute, Outlet } from "@tanstack/react-router";
import { ConvexProvider } from "convex/react";
import { clientEnv } from "@/env.public";
import { readConvexClient } from "@/lib/convex/client";

/**
 * The curriculum subtree reads Convex on entry: its selector saves a learner's
 * curriculum, so the subtree mounts the page's one client here. A visitor who
 * opens it gets that client, which decision 13 does not allow on a public page.
 * Islanding the selector's mutation is the open follow-up.
 */
export const Route = createFileRoute("/$locale/_main/curricula")({
  component: CurriculaLayout,
});

/** Mounts the one client that the curriculum pages read. */
function CurriculaLayout() {
  return (
    <ConvexProvider client={readConvexClient(clientEnv.VITE_CONVEX_URL)}>
      <Outlet />
    </ConvexProvider>
  );
}
