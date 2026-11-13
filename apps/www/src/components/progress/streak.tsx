import { Fire02Icon, StarIcon } from "@hugeicons/core-free-icons";
import type { Week } from "@repo/backend/confect/island/view";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { cva } from "class-variance-authority";
import { Array as Arr, DateTime } from "effect";
import { useTranslations } from "use-intl";
import { useProgress } from "@/components/progress/context";
import { useCurrentLocale } from "@/lib/routing/link";

/** One day of the week as a round mark: learned, today, still to come, or missed. */
const dayVariants = cva(
  "grid size-9 place-items-center rounded-full text-sm font-medium tabular-nums",
  {
    variants: {
      state: {
        ahead: "text-muted-foreground border border-dashed",
        learned: "bg-orange-500 text-white",
        missed: "bg-muted text-muted-foreground",
        today: "border-2 border-orange-500 text-orange-500",
      },
    },
  }
);

type Day = (typeof Week.Type)["days"][number];

/** How a day of the week shows, against today. */
function stateOf(day: Day, today: string) {
  if (day.stars > 0) {
    return "learned";
  }
  if (day.day === today) {
    return "today";
  }
  return day.day < today ? "missed" : "ahead";
}

/** One day of the week: its mark and the first letter of its name. */
function StreakDay({ day, today }: { day: Day; today: string }) {
  const locale = useCurrentLocale();
  const state = stateOf(day, today);
  return (
    <li className="flex flex-col items-center gap-1.5">
      <span className={dayVariants({ state })}>
        {state === "learned" ? (
          <HugeIcons className="size-4" icon={StarIcon} />
        ) : null}
      </span>
      <span className="text-muted-foreground text-xs">
        {DateTime.formatUtc(DateTime.makeUnsafe(`${day.day}T00:00:00Z`), {
          locale,
          weekday: "narrow",
        })}
      </span>
    </li>
  );
}

/**
 * The learner's streak, as a language app keeps one (the owner's home
 * sketch, 13 Nov): the run of days in a row they learned beside a flame, a
 * mark for each day of this week, and what this week gave them.
 */
export function StreakCard() {
  const t = useTranslations("Home");
  const { week } = useProgress();
  const days = week?.days ?? [];
  const streak = week?.streak ?? 0;
  const total = (field: "lessons" | "sections" | "stars") =>
    Arr.reduce(days, 0, (sum, day) => sum + day[field]);
  return (
    <Card>
      <CardHeader className="flex items-center gap-4">
        <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-orange-500/10 text-orange-500">
          <HugeIcons className="size-8" icon={Fire02Icon} />
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <CardTitle className="text-2xl font-semibold tabular-nums">
            {t("streak", { days: streak })}
          </CardTitle>
          <CardDescription>
            {t("week-summary", {
              lessons: total("lessons"),
              sections: total("sections"),
              stars: total("stars"),
            })}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <ol className="grid grid-cols-7 justify-items-center gap-1">
          {Arr.map(days, (day) => (
            <StreakDay day={day} key={day.day} today={week?.today ?? ""} />
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
