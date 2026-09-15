import "server-only";

import { ArrowDown02Icon, ViewIcon } from "@hugeicons/core-free-icons";
import { api } from "@repo/backend/convex/_generated/api";
import { Badge } from "@repo/design-system/components/ui/badge";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import type { PublicAppLocale } from "@repo/internationalization/src/routing";
import { fetchQuery } from "convex/nextjs";
import { cacheLife } from "next/cache";
import type { Locale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { MaterialRow } from "@/components/home/material-row";
import { env } from "@/env";
import { isActiveLocale } from "@/lib/i18n/active";

/**
 * Reads one point-in-time homepage popularity snapshot.
 *
 * Trending is a low-freshness aggregate, so keeping one live subscription per
 * homepage visitor would amplify every popularity-counter update. Popularity
 * is live analytics rather than signed content, so it stays on the production
 * deployment while authored content builds from the isolated snapshot. The
 * cached Promise stays direct because starting an Effect runtime during static
 * prerender reads current time, which Cache Components reject.
 *
 * @see https://nextjs.org/docs/messages/next-prerender-current-time
 * @see https://docs.convex.dev/client/nextjs/app-router/server-rendering#using-convex-to-render-server-components
 */
async function getHomeTrendingSubjects(locale: PublicAppLocale) {
  "use cache";

  cacheLife("minutes");

  return await fetchQuery(
    api.contents.queries.trending.getTrendingSubjects,
    {
      locale,
      windowKey: "7d",
    },
    { url: env.NEXT_PUBLIC_CONVEX_URL }
  );
}

/** Renders the home-screen trending learning objects for the current locale. */
export async function HomeTrending({ locale }: { locale: Locale }) {
  if (!isActiveLocale(locale)) {
    return null;
  }

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
          <MaterialRow
            key={`${subject.content_id}:${subject.contextKey}`}
            material={{
              content_id: subject.content_id,
              contextKey: subject.contextKey,
              description: subject.description,
              href: subject.href,
              materialDomain: subject.materialDomain,
              title: subject.title,
            }}
            trailing={
              <Badge className="absolute top-0 right-0 mt-0.5" variant="muted">
                <HugeIcons className="size-3" icon={ViewIcon} />
                {subject.viewCount}
              </Badge>
            }
          />
        ))}
      </div>
    </section>
  );
}
