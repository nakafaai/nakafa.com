import type { TileLook } from "@repo/design-system/lib/look";
import { Array as Arr } from "effect";
import {
  CatalogCard,
  CatalogCardVisual,
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
      <div className="grid grid-cols-1 gap-4 pt-6 pb-24 sm:grid-cols-2">
        {Arr.map(cards, ({ route, visual }, index) => (
          <CatalogCard
            action={<PublicPathLink publicPath={route.publicPath} />}
            key={route.publicPath}
            title={route.title}
          >
            <CatalogCardVisual preload={index === 0} visual={visual} />
          </CatalogCard>
        ))}
      </div>
    </CatalogActionLabelContext>
  );
}
