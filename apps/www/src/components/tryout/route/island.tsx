import type { ReactNode } from "react";
import { ConvexIsland } from "@/components/providers/island";

/**
 * Gives a page that shows an attempt the page's Convex client. A page with no attempt
 * reads none of its own, and each Convex leaf on it islands itself, so the page stays
 * mounted while the session starts and a press on it survives.
 */
export function TryoutAttemptIsland({
  children,
  live,
}: {
  children: ReactNode;
  /** Whether the page shows an attempt. */
  live: boolean;
}) {
  return live ? <ConvexIsland>{children}</ConvexIsland> : children;
}
