"use client";

import type { api } from "@repo/backend/convex/_generated/api";
import { IntentLink } from "@repo/design-system/components/ui/intent-link";
import type { FunctionReturnType } from "convex/server";
import type { Locale } from "next-intl";
import { useTranslations } from "next-intl";
import {
  CatalogCard,
  CatalogCardGradient,
  CatalogCardImage,
} from "@/components/shared/catalog/card";
import { ChoiceCardIcon } from "@/components/shared/choice/visual";
import { ComingSoon } from "@/components/shared/coming-soon";
import { getTryoutTrackIcon } from "@/components/tryout/catalog/icons";
import { getTryoutPublicPathHref } from "@/components/tryout/route/path";
import { getTryoutTrackCatalogArtwork } from "@/lib/tryout/artwork";

type ExamPageQuery = typeof api.tryouts.queries.catalog.getExamPage;

/** Renders one realtime try-out exam page from Convex. */
export function TryoutExamPageClient({
  locale,
  page,
}: {
  locale: Locale;
  page: NonNullable<FunctionReturnType<ExamPageQuery>>;
}) {
  const tTryouts = useTranslations("Tryouts");

  if (page.tracks.length === 0) {
    return <ComingSoon />;
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-6 pt-6 pb-24">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {page.tracks.map((track, index) => {
          const imageSrc = getTryoutTrackCatalogArtwork(locale, {
            countryKey: page.country.countryKey,
            examKey: page.exam.examKey,
            trackKey: track.trackKey,
            trackKind: track.trackKind,
          });

          return (
            <CatalogCard
              action={
                <IntentLink href={getTryoutPublicPathHref(track.publicPath)} />
              }
              actionLabel={tTryouts("open-set-cta")}
              badge={tTryouts("set-count", { count: track.readySetCount })}
              key={track.trackKey}
              title={track.title}
            >
              {imageSrc ? (
                <CatalogCardImage preload={index === 0} src={imageSrc} />
              ) : (
                <CatalogCardGradient seed={track.publicPath}>
                  <ChoiceCardIcon
                    icon={getTryoutTrackIcon(track.trackKind, track.trackKey)}
                  />
                </CatalogCardGradient>
              )}
            </CatalogCard>
          );
        })}
      </div>
    </div>
  );
}
