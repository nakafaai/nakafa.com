import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import type { TileLook } from "@repo/design-system/lib/look";
import { Array as Arr } from "effect";
import type { Locale } from "next-intl";
import {
  CatalogCard,
  CatalogCardVisual,
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
  const routes = Arr.map(entries, ({ route }) => route);
  const visuals = getCurriculumLooks(routes, (route) =>
    resolveCurriculumCatalogArtwork(locale, {
      kind: "program",
      programKey: route.programKey,
    })
  );

  return (
    <div className="grid grid-cols-1 gap-4 pt-6 pb-24 sm:grid-cols-2">
      {Arr.map(Arr.zip(routes, visuals), ([route, visual], index) => (
        <CurriculumCard
          actionLabel={actionLabel}
          key={route.publicPath}
          locale={locale}
          preload={index === 0}
          route={route}
          visual={visual}
        />
      ))}
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
  const visuals = getCurriculumLooks(routes, (route) =>
    resolveCurriculumCatalogArtwork(locale, {
      kind: "route",
      nodeKey: route.nodeKey,
      programKey: route.programKey,
    })
  );

  return (
    <div className="grid grid-cols-1 gap-4 pt-6 pb-24 sm:grid-cols-2">
      {Arr.map(Arr.zip(routes, visuals), ([route, visual], index) => (
        <CurriculumCard
          actionLabel={actionLabel}
          key={route.publicPath}
          locale={locale}
          preload={index === 0}
          route={route}
          visual={visual}
        />
      ))}
    </div>
  );
}

/**
 * Renders one curriculum card. Its `visual` is the source of its reviewed
 * artwork, or the look that its grid gave to its tile when it has no artwork.
 */
function CurriculumCard({
  actionLabel,
  locale,
  preload,
  route,
  visual,
}: {
  actionLabel: string;
  locale: Locale;
  preload: boolean;
  route: CurriculumViewRoute;
  visual: TileLook | string;
}) {
  return (
    <CatalogCard
      action={<NavigationLink href={`/${locale}/${route.publicPath}`} />}
      actionLabel={actionLabel}
      title={route.title}
    >
      <CatalogCardVisual preload={preload} visual={visual} />
    </CatalogCard>
  );
}
