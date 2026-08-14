import "server-only";

import { ArrowDown02Icon, ViewIcon } from "@hugeicons/core-free-icons";
import { api } from "@repo/backend/convex/_generated/api";
import { getMaterialIcon } from "@repo/contents/_lib/curriculum/material";
import { Badge } from "@repo/design-system/components/ui/badge";
import { GradientBlock } from "@repo/design-system/components/ui/gradient-block";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import { fetchQuery } from "convex/nextjs";
import { cacheLife } from "next/cache";
import type { Locale } from "next-intl";
import { getTranslations } from "next-intl/server";

/**
 * Reads one point-in-time homepage popularity snapshot.
 *
 * Trending is a low-freshness aggregate, so keeping one live subscription per
 * homepage visitor would amplify every popularity-counter update. The cached
 * Convex Promise stays direct because starting an Effect runtime during static
 * prerender reads current time, which Cache Components reject.
 *
 * @see https://nextjs.org/docs/messages/next-prerender-current-time
 * @see https://docs.convex.dev/client/nextjs/app-router/server-rendering#using-convex-to-render-server-components
 */
async function getHomeTrendingSubjects(locale: Locale) {
  "use cache";

  cacheLife("minutes");

  return await fetchQuery(api.contents.queries.trending.getTrendingSubjects, {
    locale,
    windowKey: "7d",
  });
}

/** Renders the home-screen trending learning objects for the current locale. */
export async function HomeTrending({ locale }: { locale: Locale }) {
  const [t, data] = await Promise.all([
    getTranslations({ locale, namespace: "Home" }),
    getHomeTrendingSubjects(locale),
  ]);

  if (data.length === 0) {
    return null;
  }

  return (
    <section className="flex flex-col gap-4">
      <h2 className="flex items-center gap-2 px-3 font-medium">
        {t("trending-subjects")}
        <HugeIcons className="size-4" icon={ArrowDown02Icon} />
      </h2>
      <div className="grid divide-y overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm">
        {data.map((subject) => (
          <NavigationLink
            className="group grid gap-3 p-4 transition-colors ease-out hover:bg-accent hover:text-accent-foreground"
            href={subject.href}
            key={`${subject.content_id}:${subject.contextKey}`}
          >
            <div className="flex items-start gap-3">
              <div className="relative size-10 shrink-0 overflow-hidden rounded-md">
                <GradientBlock
                  className="absolute inset-0"
                  colorScheme="vibrant"
                  intensity="medium"
                  keyString={subject.content_id}
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <HugeIcons
                    className="size-4 text-background drop-shadow-md"
                    icon={getMaterialIcon(subject.materialDomain)}
                  />
                </div>
              </div>
              <div className="-mt-1 flex flex-1 flex-col gap-0.5">
                <div className="relative">
                  <h3 className="pr-20">{subject.title}</h3>
                  <Badge
                    className="absolute top-0 right-0 mt-0.5"
                    variant="muted"
                  >
                    <HugeIcons className="size-3" icon={ViewIcon} />
                    {subject.viewCount}
                  </Badge>
                </div>
                <span className="line-clamp-1 text-muted-foreground text-sm group-hover:text-accent-foreground sm:mr-12">
                  {subject.description}
                </span>
              </div>
            </div>
          </NavigationLink>
        ))}
      </div>
    </section>
  );
}
