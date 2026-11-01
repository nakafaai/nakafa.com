import { createFileRoute, Outlet } from "@tanstack/react-router";
import { Suspense } from "react";

/**
 * The boundary of the try-out pages. A lazy part that mounts outside the router's
 * transition suspends here, so the shell's `<main>` stays on screen and only the
 * page waits.
 */
export const Route = createFileRoute("/$locale/_main/try-out")({
  component: TryoutLayout,
});

function TryoutLayout() {
  return (
    <Suspense fallback={null}>
      <Outlet />
    </Suspense>
  );
}
