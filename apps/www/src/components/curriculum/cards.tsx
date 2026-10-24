import type { TileLook } from "@repo/design-system/lib/look";
import { PublicPathLink } from "@repo/internationalization/src/public";
import { Array as Arr } from "effect";
import {
  CatalogCard,
  CatalogCardVisual,
} from "@/components/shared/catalog/card";
import type { CurriculumViewRoute } from "@/lib/curriculum/model";

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
    <div className="grid grid-cols-1 gap-4 pt-6 pb-24 sm:grid-cols-2">
      {Arr.map(cards, ({ route, visual }, index) => (
        <CurriculumCard
          actionLabel={actionLabel}
          key={route.publicPath}
          preload={index === 0}
          route={route}
          visual={visual}
        />
      ))}
    </div>
  );
}

/** Renders one curriculum card with its visual and its page link. */
function CurriculumCard({
  actionLabel,
  preload,
  route,
  visual,
}: {
  actionLabel: string;
  preload: boolean;
  route: CurriculumViewRoute;
  visual: TileLook | string;
}) {
  return (
    <CatalogCard
      action={<PublicPathLink publicPath={route.publicPath} />}
      actionLabel={actionLabel}
      title={route.title}
    >
      <CatalogCardVisual preload={preload} visual={visual} />
    </CatalogCard>
  );
}
