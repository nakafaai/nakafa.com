import type { Ref } from "@confect/core";

import type contents from "@repo/backend/confect/_generated/refs/contents";
import { Tile, TileIcon } from "@repo/design-system/components/ui/tile";
import type { TileLook } from "@repo/design-system/lib/look";
import { HrefLink } from "@repo/internationalization/src/link";

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
 * markup. The `look` is the icon and the turn that the list gave this row (see
 * `getMaterialLooks`), so that no two rows of one list share an icon or a
 * blend.
 */
export function MaterialRow({
  look,
  material,
}: {
  look: TileLook;
  material: HomeMaterial;
}) {
  return (
    <HrefLink
      className="group grid gap-3 p-4 transition-colors ease-out hover:bg-accent hover:text-accent-foreground"
      href={material.href}
    >
      <div className="flex items-start gap-3">
        <Tile seed={look.seed} shift={look.shift}>
          <TileIcon icon={look.icon} />
        </Tile>
        <div className="-mt-1 flex flex-1 flex-col gap-0.5">
          <h3>{material.title}</h3>
          <span className="line-clamp-1 text-muted-foreground text-sm group-hover:text-accent-foreground sm:mr-12">
            {material.description}
          </span>
        </div>
      </div>
    </HrefLink>
  );
}
