"use client";

import type { Ref } from "@confect/core";

import type contents from "@repo/backend/confect/_generated/refs/contents";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import { Tile, TileIcon } from "@repo/design-system/components/ui/tile";
import type { TileLook } from "@repo/design-system/lib/tile";

import type { ReactNode } from "react";

/**
 * The fields one home list row renders.
 *
 * Continue Learning and Trending both extend the shared content-summary
 * contract, so one projection of it covers both and excludes the fields only
 * one ranked query returns.
 */
type RankedMaterial = Ref.Returns<
  typeof contents.queries.recent.getRecentlyViewed
>[number];

type HomeMaterial = Pick<
  RankedMaterial,
  "content_id" | "contextKey" | "description" | "href" | "title"
>;

/**
 * Renders one home learning row.
 *
 * Continue Learning and Trending read the same row shape, so they share this
 * markup and differ only through `trailing`. The `look` is the icon and the
 * turn that the list gave this row (see `getMaterialLooks`), so that no two
 * rows of one list share an icon or a blend.
 */
export function MaterialRow({
  look,
  material,
  trailing,
}: {
  look: TileLook;
  material: HomeMaterial;
  trailing?: ReactNode;
}) {
  return (
    <NavigationLink
      className="group grid gap-3 p-4 transition-colors ease-out hover:bg-accent hover:text-accent-foreground"
      href={material.href}
    >
      <div className="flex items-start gap-3">
        <Tile seed={look.seed} shift={look.shift}>
          <TileIcon icon={look.icon} />
        </Tile>
        <div className="-mt-1 flex flex-1 flex-col gap-0.5">
          {trailing ? (
            <div className="relative">
              <h3 className="pr-20">{material.title}</h3>
              {trailing}
            </div>
          ) : (
            <h3>{material.title}</h3>
          )}
          <span className="line-clamp-1 text-muted-foreground text-sm group-hover:text-accent-foreground sm:mr-12">
            {material.description}
          </span>
        </div>
      </div>
    </NavigationLink>
  );
}
