import type { Ref } from "@confect/core";
import type tryouts from "@repo/backend/confect/_generated/refs/tryouts";
import { getTileLooks } from "@repo/design-system/lib/look";
import { cn } from "cn";

import { Array as Arr, Tuple } from "effect";
import type { Locale } from "use-intl";
import { useTranslations } from "use-intl";
import {
  CatalogCard,
  CatalogCardVisual,
} from "@/components/shared/catalog/card";
import { CatalogActionLabelContext } from "@/components/shared/catalog/label";
import {
  pageRhythmVariants,
  pageRowVariants,
} from "@/components/shared/page/width";
import { ComingSoon } from "@/components/shared/upcoming";
import { getTryoutSubjectIcons } from "@/components/tryout/catalog/icons";
import { TryoutPageLink } from "@/components/tryout/route/link";
import { getTryoutTrackCatalogArtwork } from "@/lib/tryout/artwork";

type GroupPageQuery = typeof tryouts.queries.catalog.getGroupPage;

/** Renders the tracks of one try-out group, each a card with its artwork or its subject's icon. */
export function TryoutGroupPageClient({
  locale,
  page,
}: {
  locale: Locale;
  page: NonNullable<Ref.Returns<GroupPageQuery>>;
}) {
  const tTryouts = useTranslations("Tryouts");

  if (page.tracks.length === 0) {
    return <ComingSoon />;
  }

  const visuals = getTileLooks(
    Arr.map(
      page.tracks,
      (track) =>
        getTryoutTrackCatalogArtwork(locale, {
          countryKey: page.country.countryKey,
          examKey: page.exam.examKey,
          trackKey: track.trackKey,
        }) ?? Tuple.make(getTryoutSubjectIcons(track.trackKey), track.trackKey)
    )
  );

  return (
    <CatalogActionLabelContext value={tTryouts("open-set-cta")}>
      <div className={cn(pageRowVariants(), pageRhythmVariants(), "pb-24")}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {Arr.map(Arr.zip(page.tracks, visuals), ([track, visual], index) => (
            <CatalogCard
              action={(anchor) => (
                <TryoutPageLink {...anchor} publicPath={track.publicPath} />
              )}
              key={track.trackKey}
              title={track.title}
            >
              <CatalogCardVisual preload={index === 0} visual={visual} />
            </CatalogCard>
          ))}
        </div>
      </div>
    </CatalogActionLabelContext>
  );
}
