import type { Placement } from "@repo/backend/confect/island/layout";
import type { Materials } from "@repo/backend/confect/island/material";
import type { Option } from "effect";
import { createContext, use } from "react";

/**
 * The island a frame shows: its placements, the side of its square in cells,
 * the IANA name of its zone, and, on its owner's own page, what editing and the
 * garden read: the owner's level, the Stars and materials they can spend, the
 * version they edit, and the last days they learned and watered. The page that
 * holds the island provides it, and the frame and the lazily loaded canvas
 * read it, so no component hands it on.
 */
export const IslandContext = createContext<{
  readonly layout: readonly Placement[];
  readonly owner: Option.Option<{
    readonly learned: Option.Option<string>;
    readonly level: number;
    readonly materials: Materials;
    readonly stars: number;
    readonly version: number;
    readonly watered: Option.Option<string>;
  }>;
  readonly size: number;
  readonly timeZone: string;
} | null>(null);

/** Returns the island of the surrounding frame and rejects a missing provider. */
export function useIsland() {
  const island = use(IslandContext);
  if (!island) {
    throw new Error("useIsland must be used within IslandContext");
  }
  return island;
}
