import type { Ref } from "@confect/core";

import type tryouts from "@repo/backend/confect/_generated/refs/tryouts";
import { getTileLooks } from "@repo/design-system/lib/look";

import { Array as Arr, Tuple } from "effect";
import type { Locale } from "use-intl";
import { useTranslations } from "use-intl";
import {
  CatalogCard,
  CatalogCardVisual,
} from "@/components/shared/catalog/card";
import { CatalogActionLabelContext } from "@/components/shared/catalog/label";
import { ComingSoon } from "@/components/shared/upcoming";
import { getTryoutTrackIcons } from "@/components/tryout/catalog/icons";
import { TryoutPageLink } from "@/components/tryout/route/link";
import { getTryoutTrackCatalogArtwork } from "@/lib/tryout/artwork";

type ExamPageQuery = typeof tryouts.queries.catalog.getExamPage;

/** Renders one realtime try-out exam page from Convex. */
export function TryoutExamPageClient({
  locale,
  page,
}: {
  locale: Locale;
  page: NonNullable<Ref.Returns<ExamPageQuery>>;
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
          trackKind: track.trackKind,
        }) ??
        Tuple.make(
          getTryoutTrackIcons(track.trackKind, track.trackKey),
          track.trackKey
        )
    )
  );

  return (
    <CatalogActionLabelContext value={tTryouts("open-set-cta")}>
      <div className="mx-auto w-full max-w-3xl px-6 pt-6 pb-24">
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
