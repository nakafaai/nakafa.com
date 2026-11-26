import type { TileLook } from "@repo/design-system/lib/look";
import { Array as Arr } from "effect";
import {
  CatalogCard,
  CatalogCardVisual,
  CatalogGrid,
} from "@/components/shared/catalog/card";
import { CatalogActionLabelContext } from "@/components/shared/catalog/label";
import type { CurriculumViewRoute } from "@/lib/curriculum/model";
import { PublicPathLink } from "@/lib/routing/public/link";

/**
 * Renders one grid of curriculum cards with explicit actions. Each card carries
 * its visual: the reviewed artwork of its route, or the look that its list gave
 * to its tile. The server chooses the visuals, so this module never reads the
 * server-only look module.
 */
export function CurriculumCardGrid({
  actionLabel,
  cards,
}: {
  actionLabel: string;
  cards: readonly {
    readonly route: CurriculumViewRoute;
    readonly visual: TileLook | string;
  }[];
}) {
  return (
    <CatalogActionLabelContext value={actionLabel}>
      <CatalogGrid>
        {Arr.map(cards, ({ route, visual }, index) => (
          <CatalogCard
            action={(anchor) => (
              <PublicPathLink {...anchor} publicPath={route.publicPath} />
            )}
            key={route.publicPath}
            title={route.title}
          >
            <CatalogCardVisual preload={index === 0} visual={visual} />
          </CatalogCard>
        ))}
      </CatalogGrid>
    </CatalogActionLabelContext>
  );
}
