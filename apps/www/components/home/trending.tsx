import { ArrowDown02Icon } from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import type { TileLook } from "@repo/design-system/lib/look";
import { Array as Arr } from "effect";
import { useTranslations } from "use-intl";
import { MaterialRow } from "@/components/home/material";
import type { getHomeTrendingSubjects } from "@/lib/content/trending";

/** The trending subjects of the home page, read by the route loader with their looks. */
type TrendingSubjects = Awaited<ReturnType<typeof getHomeTrendingSubjects>>;

/**
 * Renders the home-screen trending learning objects. The route loader reads the
 * rows and the looks that the lists above this one leave free, so no trending
 * row repeats an icon that the page already shows.
 */
export function HomeTrending({
  looks,
  subjects,
}: {
  looks: readonly TileLook[];
  subjects: TrendingSubjects;
}) {
  const t = useTranslations("Home");
  if (subjects.length === 0) {
    return null;
  }
  return (
    <section className="flex flex-col gap-4">
      <h2 className="flex items-center gap-2 px-3 font-medium">
        {t("trending-subjects")}
        <HugeIcons className="size-4" icon={ArrowDown02Icon} />
      </h2>
      <div className="grid divide-y overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm">
        {Arr.zipWith(subjects, looks, (subject, look) => (
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
