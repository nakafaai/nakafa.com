"use client";

import type { api } from "@repo/backend/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import { useTranslations } from "next-intl";
import { ChoiceCardContent } from "@/components/shared/choice/card";
import { choiceCardVariants } from "@/components/shared/choice/variants";
import {
  ChoiceCardIcon,
  ChoiceCardVisual,
} from "@/components/shared/choice/visual";
import { ComingSoon } from "@/components/shared/coming-soon";
import { getTryoutTrackIcon } from "@/components/tryout/catalog/icons";
import { TryoutIntentLink } from "@/components/tryout/navigation/link.client";
import { getTryoutPublicPathHref } from "@/components/tryout/route/path";

type ExamPageQuery = typeof api.tryouts.queries.catalog.getExamPage;

/** Renders one realtime try-out exam page from Convex. */
export function TryoutExamPageClient({
  page,
}: {
  page: NonNullable<FunctionReturnType<ExamPageQuery>>;
}) {
  const tTryouts = useTranslations("Tryouts");

  if (page.tracks.length === 0) {
    return <ComingSoon />;
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-6 pt-6 pb-24">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        {page.tracks.map((track) => {
          const icon = getTrackCardIcon(track);

          return (
            <TryoutIntentLink
              className={choiceCardVariants()}
              href={getTryoutPublicPathHref(track.publicPath)}
              key={track.trackKey}
            >
              <ChoiceCardVisual seed={track.publicPath}>
                <TryoutTrackCardIcon icon={icon} />
              </ChoiceCardVisual>
              <ChoiceCardContent>
                <div className="grid gap-1">
                  <h2>{track.title}</h2>
                  <p className="text-muted-foreground text-sm">
                    {track.description ??
                      tTryouts("set-count", { count: track.readySetCount })}
                  </p>
                </div>
              </ChoiceCardContent>
            </TryoutIntentLink>
          );
        })}
      </div>
    </div>
  );
}

/** Renders subject-track artwork while year tracks remain intentionally empty. */
function TryoutTrackCardIcon({
  icon,
}: {
  icon: ReturnType<typeof getTrackCardIcon>;
}) {
  if (!icon) {
    return null;
  }

  return <ChoiceCardIcon icon={icon} />;
}

/** Resolve subject tracks to icons while leaving year tracks text-free. */
function getTrackCardIcon(track: {
  trackKey: string;
  trackKind: "subject" | "year";
}) {
  if (track.trackKind === "subject") {
    return getTryoutTrackIcon(track.trackKey);
  }

  return null;
}
