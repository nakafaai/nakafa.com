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
import { getCurriculumLooks } from "@/lib/curriculum/look";
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
  const looks = getCurriculumLooks(Arr.map(entries, ({ route }) => route));

  return (
    <div className="grid grid-cols-1 gap-4 pt-6 pb-24 sm:grid-cols-2">
      {Arr.map(Arr.zip(entries, looks), ([{ program, route }, look], index) => {
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
              <CatalogCardTile seed={look.seed} shift={look.shift}>
                <TileIcon icon={look.icon} />
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
  const looks = getCurriculumLooks(routes);

  return (
    <div className="grid grid-cols-1 gap-4 pt-6 pb-24 sm:grid-cols-2">
      {Arr.map(Arr.zip(routes, looks), ([route, look], index) => {
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
              <CatalogCardTile seed={look.seed} shift={look.shift}>
                <TileIcon icon={look.icon} />
              </CatalogCardTile>
            )}
          </CatalogCard>
        );
      })}
    </div>
  );
}
