"use client";

import type { api } from "@repo/backend/convex/_generated/api";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import type { Preloaded } from "convex/react";
import { usePreloadedQuery } from "convex/react";
import { useTranslations } from "next-intl";
import { choiceCardVariants } from "@/components/shared/choice-card";
import { ComingSoon } from "@/components/shared/coming-soon";
import { getTryoutTrackIcon } from "@/components/tryout/catalog/icons";
import {
  TryoutCardIcon,
  TryoutCardVisual,
} from "@/components/tryout/catalog/visual";
import { getTryoutPublicPathHref } from "@/components/tryout/route/path";

type ExamPageQuery = typeof api.tryouts.queries.catalog.getExamPage;

/** Renders one realtime try-out exam page from Convex. */
export function TryoutExamPageClient({
  preloaded,
}: {
  preloaded: Preloaded<ExamPageQuery>;
}) {
  const page = usePreloadedQuery(preloaded);
  const tTryouts = useTranslations("Tryouts");

  if (!page) {
    return null;
  }

  if (page.tracks.length === 0) {
    return <ComingSoon />;
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-6 pt-6 pb-24">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        {page.tracks.map((track) => {
          const icon = getTrackCardIcon(track);

          return (
            <NavigationLink
              className={choiceCardVariants()}
              href={getTryoutPublicPathHref(track.publicPath)}
              key={track.trackKey}
            >
              <TryoutCardVisual keyString={track.publicPath}>
                {icon ? <TryoutCardIcon icon={icon} /> : null}
              </TryoutCardVisual>
              <div className="px-6 py-3 text-center">
                <h2>{track.title}</h2>
                <p className="mt-1 text-muted-foreground text-sm">
                  {track.description ??
                    tTryouts("set-count", { count: track.readySetCount })}
                </p>
              </div>
            </NavigationLink>
          );
        })}
      </div>
    </div>
  );
}

function getTrackCardIcon(track: {
  trackKey: string;
  trackKind: "subject" | "year";
}) {
  if (track.trackKind === "subject") {
    return getTryoutTrackIcon(track.trackKey);
  }

  return null;
}
