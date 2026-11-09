import type { Ref } from "@confect/core";
import {
  DropletsIcon,
  Fire02Icon,
  Medal01Icon,
  StarIcon,
} from "@hugeicons/core-free-icons";
import type contents from "@repo/backend/confect/_generated/refs/contents";
import type island from "@repo/backend/confect/_generated/refs/island";
import { STREAK_DAYS } from "@repo/backend/confect/island/week";
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

/** One day of the try-out run toward the fountain: done, or still ahead. */
const runVariants = cva("h-1.5 rounded-full", {
  variants: {
    done: { false: "bg-muted", true: "bg-sky-500" },
  },
});

/** The days of the try-out run, first to seventh. */
const RUN_DAYS = Arr.makeBy(STREAK_DAYS, (index) => index + 1);

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
 * The week of try-outs that earns the fountain and the Streak badge (ADR 0047,
 * D19): the fountain, a mark for each of its seven days, done or ahead, and
 * the days done; once earned, the badge.
 */
function TryoutRun({ week }: { week: Week | undefined }) {
  const t = useTranslations("Home");
  const rewarded = week?.rewarded ?? false;
  const done = rewarded
    ? STREAK_DAYS
    : Math.min(week?.tryouts ?? 0, STREAK_DAYS);
  return (
    <div className="flex items-center gap-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300">
        <HugeIcons
          className="size-5"
          icon={rewarded ? Medal01Icon : DropletsIcon}
        />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <p className="text-sm">
          {rewarded ? t("tryout-earned") : t("tryout-reward")}
        </p>
        <ol aria-hidden="true" className="grid grid-cols-7 gap-1">
          {Arr.map(RUN_DAYS, (day) => (
            <RunMark done={day <= done} key={day} />
          ))}
        </ol>
      </div>
      <span className="text-muted-foreground shrink-0 text-sm tabular-nums">
        {done}/{STREAK_DAYS}
      </span>
    </div>
  );
}

/** One day of the try-out run. */
function RunMark({ done }: { done: boolean }) {
  return <li className={runVariants({ done })} />;
}

/**
 * The learner's week, compact under their island (ADR 0047): the run of days
 * in a row they learned, a mark for each day of this week, the try-out run
 * toward the fountain, what they learned this week and the Stars it gave, and
 * the lesson to pick up again.
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
      <TryoutRun week={week} />
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
