import type { Ref } from "@confect/core";
import { Fire02Icon, StarIcon } from "@hugeicons/core-free-icons";
import type contents from "@repo/backend/confect/_generated/refs/contents";
import type island from "@repo/backend/confect/_generated/refs/island";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import type { TileLook } from "@repo/design-system/lib/look";
import { cva } from "class-variance-authority";
import { Array as Arr, DateTime } from "effect";
import { useTranslations } from "use-intl";
import { MaterialRow } from "@/components/home/material";
import { useCurrentLocale } from "@/lib/routing/link";

/** One day of the week as a round mark: learned, today, still to come, or missed. */
const dayVariants = cva(
  "grid size-9 place-items-center rounded-full text-sm font-medium tabular-nums",
  {
    variants: {
      state: {
        ahead: "text-muted-foreground border border-dashed",
        learned: "bg-primary text-primary-foreground",
        missed: "bg-muted text-muted-foreground",
        today: "border-primary text-primary border-2",
      },
    },
  }
);

type Week = NonNullable<Ref.Returns<typeof island.queries.week>>;

/** How a day of the week shows, against today. */
function stateOf(day: Week["days"][number], today: string) {
  if (day.stars > 0) {
    return "learned";
  }
  if (day.day === today) {
    return "today";
  }
  return day.day < today ? "missed" : "ahead";
}

/** One day of the week: its mark and the first letter of its name. */
function WeekDay({ day, today }: { day: Week["days"][number]; today: string }) {
  const locale = useCurrentLocale();
  const state = stateOf(day, today);
  return (
    <li className="flex flex-col items-center gap-1.5">
      <span className={dayVariants({ state })}>
        {state === "learned" ? (
          <HugeIcons className="size-4" icon={StarIcon} />
        ) : null}
      </span>
      <span className="text-muted-foreground text-sm">
        {DateTime.formatUtc(DateTime.makeUnsafe(`${day.day}T00:00:00Z`), {
          locale,
          weekday: "narrow",
        })}
      </span>
    </li>
  );
}

/**
 * The learner's week, compact under their island (ADR 0047): the run of days
 * in a row they learned, a mark for each day of this week, what they learned
 * this week and the Stars it gave, and the lesson to pick up again.
 */
export function HomeWeek({
  look,
  recent,
  week,
}: {
  look: TileLook | undefined;
  recent:
    | Ref.Returns<typeof contents.queries.recent.getRecentlyViewed>[number]
    | undefined;
  week: Week | undefined;
}) {
  const t = useTranslations("Home");
  const days = week?.days ?? [];
  const total = (field: "lessons" | "sections" | "stars") =>
    Arr.reduce(days, 0, (sum, day) => sum + day[field]);
  return (
    <section className="bg-card text-card-foreground flex flex-col gap-4 rounded-xl border p-4 shadow-xs">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-medium">{t("week-title")}</h2>
        <p className="flex items-center gap-1.5 text-sm font-medium">
          <HugeIcons className="size-4 text-orange-500" icon={Fire02Icon} />
          {t("streak", { days: week?.streak ?? 0 })}
        </p>
      </header>
      <ol className="grid grid-cols-7 justify-items-center gap-1">
        {Arr.map(days, (day) => (
          <WeekDay day={day} key={day.day} today={week?.today ?? ""} />
        ))}
      </ol>
      <p className="text-muted-foreground text-sm">
        {t("week-summary", {
          lessons: total("lessons"),
          sections: total("sections"),
          stars: total("stars"),
        })}
      </p>
      {recent === undefined || look === undefined ? null : (
        <div className="-mx-4 -mb-4 border-t">
          <MaterialRow look={look} material={recent} />
        </div>
      )}
    </section>
  );
}
