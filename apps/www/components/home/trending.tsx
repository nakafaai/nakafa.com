import { Array as Arr } from "effect";
import "server-only";
import { ArrowDown02Icon, ViewIcon } from "@hugeicons/core-free-icons";
import { Badge } from "@repo/design-system/components/ui/badge";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import type { Locale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { MaterialRow } from "@/components/home/material";
import { getHomeTrendingSubjects } from "@/lib/content/trending";
import { isActiveLocale } from "@/lib/i18n/active";

/** Renders the home-screen trending learning objects for the current locale. */
export async function HomeTrending({ locale }: { locale: Locale }) {
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
  return (
    <section className="flex flex-col gap-4">
      <h2 className="flex items-center gap-2 px-3 font-medium">
        {t("trending-subjects")}
        <HugeIcons className="size-4" icon={ArrowDown02Icon} />
      </h2>
      <div className="grid divide-y overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm">
        {Arr.map(data, (subject) => (
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
