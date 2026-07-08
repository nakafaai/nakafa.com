"use client";

import type { api } from "@repo/backend/convex/_generated/api";
import { GradientBlock } from "@repo/design-system/components/ui/gradient-block";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import type { Preloaded } from "convex/react";
import { usePreloadedQuery } from "convex/react";
import { useTranslations } from "next-intl";
import { choiceCardVariants } from "@/components/shared/choice-card";
import { ComingSoon } from "@/components/shared/coming-soon";
import { getTryoutTrackIcon } from "@/components/tryout/icons";
import { getTryoutPublicPathHref } from "@/components/tryout/routes";

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
          const icon =
            track.trackKind === "subject"
              ? getTryoutTrackIcon(track.trackKey)
              : null;

          return (
            <NavigationLink
              className={choiceCardVariants()}
              href={getTryoutPublicPathHref(track.publicPath)}
              key={track.trackKey}
            >
              <div className="relative flex aspect-video w-full items-center justify-center">
                <GradientBlock
                  className="mask-[linear-gradient(to_bottom,black_0%,black_65%,transparent_100%)] mask-no-repeat mask-size-[100%_100%] pointer-events-none absolute inset-0 opacity-20"
                  colorScheme="vibrant"
                  intensity="medium"
                  keyString={track.publicPath}
                />
                {icon ? (
                  <HugeIcons
                    aria-hidden
                    className="relative size-6 text-foreground"
                    icon={icon}
                  />
                ) : (
                  <span className="relative font-mono text-2xl text-foreground tabular-nums">
                    {track.trackKey}
                  </span>
                )}
              </div>
              <div className="px-6 pt-3 pb-6 text-center">
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
