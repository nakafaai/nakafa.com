import { Array as Arr } from "effect";
import "server-only";
import { ArrowDown02Icon } from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import type { TileLook } from "@repo/design-system/lib/look";
import type { Locale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { getMaterialLooks } from "@/components/home/look";
import { MaterialRow } from "@/components/home/material";
import { getHomeTrendingSubjects } from "@/lib/content/trending";
import { isActiveLocale } from "@/lib/i18n/active";

/**
 * Renders the home-screen trending learning objects for the current locale.
 * The page passes the looks of the lists above this one as `shown`, so no
 * trending row repeats an icon that the page already shows.
 */
export async function HomeTrending({
  locale,
  shown,
}: {
  locale: Locale;
  shown: readonly TileLook[];
}) {
  if (!isActiveLocale(locale)) {
    return null;
  }
  const [t, data] = await Promise.all([
    getTranslations({
      locale,
      namespace: "Home",
    }),
    getHomeTrendingSubjects(locale),
  ]);
  if (data.length === 0) {
    return null;
  }
  const looks = getMaterialLooks(data, shown);
  return (
    <section className="flex flex-col gap-4">
      <h2 className="flex items-center gap-2 px-3 font-medium">
        {t("trending-subjects")}
        <HugeIcons className="size-4" icon={ArrowDown02Icon} />
      </h2>
      <div className="grid divide-y overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm">
        {Arr.zipWith(data, looks, (subject, look) => (
          <MaterialRow
            key={`${subject.content_id}:${subject.contextKey}`}
            look={look}
            material={{
              content_id: subject.content_id,
              contextKey: subject.contextKey,
              description: subject.description,
              href: subject.href,
              title: subject.title,
            }}
          />
        ))}
      </div>
    </section>
  );
}
