import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import { TileIcon } from "@repo/design-system/components/ui/tile";
import { Array as Arr } from "effect";
import type { Locale } from "next-intl";
import {
  CatalogCard,
  CatalogCardImage,
  CatalogCardTile,
} from "@/components/shared/catalog/card";
import { resolveCurriculumCatalogArtwork } from "@/lib/curriculum/artwork";
import { readCurriculumRouteIcon } from "@/lib/curriculum/icons";
import type {
  CurriculumCatalogEntry,
  CurriculumViewRoute,
} from "@/lib/curriculum/model";

/** Renders the public Curriculum index as image cards with explicit actions. */
export function CurriculumCatalogCards({
  actionLabel,
  entries,
  locale,
}: {
  actionLabel: string;
  entries: readonly CurriculumCatalogEntry[];
  locale: Locale;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 pt-6 pb-24 sm:grid-cols-2">
      {Arr.map(entries, ({ program, route }, index) => {
        const imageSrc = resolveCurriculumCatalogArtwork(locale, {
          kind: "program",
          programKey: program.key,
        });

        return (
          <CatalogCard
            action={<NavigationLink href={`/${locale}/${route.publicPath}`} />}
            actionLabel={actionLabel}
            key={route.publicPath}
            title={route.title}
          >
            {imageSrc ? (
              <CatalogCardImage preload={index === 0} src={imageSrc} />
            ) : (
              <CatalogCardTile seed={route.nodeKey}>
                <TileIcon icon={readCurriculumRouteIcon(route)} />
              </CatalogCardTile>
            )}
          </CatalogCard>
        );
      })}
    </div>
  );
}

/** Renders curriculum child routes with reviewed art or an identity tile. */
export function CurriculumChildCards({
  actionLabel,
  locale,
  routes,
}: {
  actionLabel: string;
  locale: Locale;
  routes: readonly CurriculumViewRoute[];
}) {
  return (
    <div className="grid grid-cols-1 gap-4 pt-6 pb-24 sm:grid-cols-2">
      {Arr.map(routes, (route, index) => {
        const imageSrc = resolveCurriculumCatalogArtwork(locale, {
          nodeKey: route.nodeKey,
          programKey: route.programKey,
          kind: "route",
        });

        return (
          <CatalogCard
            action={<NavigationLink href={`/${locale}/${route.publicPath}`} />}
            actionLabel={actionLabel}
            key={route.publicPath}
            title={route.title}
          >
            {imageSrc ? (
              <CatalogCardImage preload={index === 0} src={imageSrc} />
            ) : (
              <CatalogCardTile seed={route.nodeKey}>
                <TileIcon icon={readCurriculumRouteIcon(route)} />
              </CatalogCardTile>
            )}
          </CatalogCard>
        );
      })}
    </div>
  );
}
