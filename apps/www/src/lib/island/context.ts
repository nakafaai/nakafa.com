import type { Placement } from "@repo/backend/confect/island/layout";
import type { Materials } from "@repo/backend/confect/island/material";
import type { Visibility } from "@repo/backend/confect/island/schema";
import { useRequired } from "@repo/design-system/hooks/required";
import type { Option } from "effect";
import { createContext } from "react";

/**
 * The island a frame shows: its placements, level, badges earned, the side of
 * its square in cells and the IANA name of its zone, and, on its owner's own
 * page, what editing, the garden and sharing read: the lifetime Stars and the
 * Stars and materials they can spend, the version they edit, the last days
 * they learned and watered, who may visit and the owner's username for the
 * link. A visit has no owner. The page that holds the island provides it, and
 * the frame and the lazily loaded canvas read it, so no component hands it on.
 */
export const IslandContext = createContext<{
  readonly badges: number;
  readonly layout: readonly Placement[];
  readonly level: number;
  readonly owner: Option.Option<{
    readonly learned: Option.Option<string>;
    readonly lifetime: number;
    readonly materials: Materials;
    readonly stars: number;
    readonly username: Option.Option<string>;
    readonly version: number;
    readonly visibility: typeof Visibility.Type;
    readonly watered: Option.Option<string>;
  }>;
  readonly size: number;
  readonly timeZone: string;
} | null>(null);

/** Returns the island of the surrounding frame and rejects a missing provider. */
export function useIsland() {
  return useRequired(IslandContext, "useIsland");
}
