import type { Ref } from "@confect/core";

import type contents from "@repo/backend/confect/_generated/refs/contents";
import { Tile, TileIcon } from "@repo/design-system/components/ui/tile";
import type { TileLook } from "@repo/design-system/lib/look";
import { rowLinkVariants } from "@repo/design-system/lib/row";
import { HomeRowText } from "@/components/home/row";
import { AddressLink } from "@/lib/routing/public/link";

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
    <AddressLink address={material.href} className={rowLinkVariants()}>
      <Tile seed={look.seed} shift={look.shift}>
        <TileIcon icon={look.icon} />
      </Tile>
      <HomeRowText description={material.description} title={material.title} />
    </AddressLink>
  );
}
