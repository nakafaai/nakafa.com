import type { Ref } from "@confect/core";
import type tryouts from "@repo/backend/confect/_generated/refs/tryouts";
import { cn } from "cn";

import { Array as Arr } from "effect";
import type { Locale } from "use-intl";
import { useTranslations } from "use-intl";
import {
  CatalogCard,
  CatalogCardPlate,
  CatalogCardVisual,
} from "@/components/shared/catalog/card";
import { CatalogActionLabelContext } from "@/components/shared/catalog/label";
import { pageRowVariants } from "@/components/shared/content/width";
import { ComingSoon } from "@/components/shared/upcoming";
import { TryoutPageLink } from "@/components/tryout/route/link";
import { getTryoutTrackCatalogArtwork } from "@/lib/tryout/artwork";

type GroupPageQuery = typeof tryouts.queries.catalog.getGroupPage;

/** Renders the tracks of one try-out group, each a card with its own artwork or its name on a plate. */
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

  return (
    <CatalogActionLabelContext value={tTryouts("open-set-cta")}>
      <div className={cn(pageRowVariants(), "pt-6 pb-24")}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {Arr.map(page.tracks, (track, index) => {
            const art = getTryoutTrackCatalogArtwork(locale, {
              countryKey: page.country.countryKey,
              examKey: page.exam.examKey,
              trackKey: track.trackKey,
            });
            return (
              <CatalogCard
                action={(anchor) => (
                  <TryoutPageLink {...anchor} publicPath={track.publicPath} />
                )}
                key={track.trackKey}
                title={track.title}
              >
                {art === undefined ? (
                  <CatalogCardPlate title={track.title} />
                ) : (
                  <CatalogCardVisual preload={index === 0} visual={art} />
                )}
              </CatalogCard>
            );
          })}
        </div>
      </div>
    </CatalogActionLabelContext>
  );
}
