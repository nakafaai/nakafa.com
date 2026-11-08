import type { Placement } from "@repo/backend/confect/island/layout";
import { createContext, use } from "react";

/**
 * The island a frame shows: its placements and the side of its square in
 * cells. The page that holds the island provides it, and the frame and the
 * lazily loaded canvas read it, so no component hands it on.
 */
export const IslandContext = createContext<{
  readonly layout: readonly Placement[];
  readonly size: number;
} | null>(null);

/** Returns the island of the surrounding frame and rejects a missing provider. */
export function useIsland() {
  const island = use(IslandContext);
  if (!island) {
    throw new Error("useIsland must be used within IslandContext");
  }
  return island;
}
