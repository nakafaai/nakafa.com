import { tierOf } from "@repo/backend/confect/progress/badge";
import { Button } from "@repo/design-system/components/ui/button";
import { Card } from "@repo/design-system/components/ui/card";
import { Ember, Flame } from "@repo/design-system/components/ui/flame";
import { Nina } from "@repo/design-system/components/ui/nina";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/design-system/components/ui/tooltip";
import { cva } from "class-variance-authority";
import { Array as Arr, DateTime, Option } from "effect";
import {
  domAnimation,
  LazyMotion,
  useAnimationControls,
  useReducedMotion,
} from "motion/react";
// biome-ignore lint/performance/noNamespaceImport: Motion documents this namespace for the smaller LazyMotion entrypoint.
import * as m from "motion/react-m";
import { useTranslations } from "use-intl";
import { useProgress } from "@/components/progress/context";
import { emptyWeek, weekBars } from "@/components/progress/level";
import { LevelMeter } from "@/components/progress/meter";
import { usePanes, useWide } from "@/components/shared/page/panes";
import { useCurrentLocale } from "@/lib/routing/link";

type Bar = ReturnType<typeof weekBars>["bars"][number];

/** A day of the week: today stands on a quiet ground, a day still to come is faint. */
const dayVariants = cva(
  "flex min-w-0 flex-1 flex-col items-center gap-1 rounded-lg py-2",
  {
    variants: {
      state: {
        ahead: "opacity-40",
        past: "",
        today: "bg-muted",
      },
    },
  }
);

/** How a day stands against today. */
function stateOf(bar: Bar) {
  if (bar.today) {
    return "today" as const;
  }
  return bar.ahead ? ("ahead" as const) : ("past" as const);
}

/** One day of the week: a small flame once the learner learned on it, cold coals until then, over the first letter of its name. */
function WeekDay({ bar }: { bar: Bar }) {
  const t = useTranslations("Home");
  const locale = useCurrentLocale();
  const date = DateTime.makeUnsafe(`${bar.day}T00:00:00Z`);
  return (
    <li className="flex min-w-0 flex-1">
      <Tooltip>
        <TooltipTrigger
          render={<span className={dayVariants({ state: stateOf(bar) })} />}
        >
          <Ember className="w-7" lit={bar.stars > 0} />
          <span className="text-muted-foreground text-xs">
            {DateTime.formatUtc(date, { locale, weekday: "narrow" })}
          </span>
        </TooltipTrigger>
        <TooltipContent>
          {t("day-stars", {
            day: DateTime.formatUtc(date, { locale, weekday: "long" }),
            stars: bar.stars,
          })}
        </TooltipContent>
      </Tooltip>
    </li>
  );
}

/**
 * The first section of the home (the owner's home notes, 14 Nov): who is
 * here and one sentence on today; the run of days as a drawn flame that grows
 * with it, beside the week, a small flame for every day learned; and on a
 * phone the learner's level with the button that opens the progress pane.
 * Nina keeps the fire: she stands beside the flame and fans it, her one act
 * of this place, and a press on her makes the flame flare. Nothing here takes
 * the primary colour: that belongs to the header's button.
 */
export function HomeStreak({
  name,
  now,
}: {
  name: Option.Option<string>;
  now: number;
}) {
  const t = useTranslations("Home");
  const tProgress = useTranslations("Progress");
  const wide = useWide();
  const still = useReducedMotion();
  const fan = useAnimationControls();
  const showSheet = usePanes((state) => state.showSheet);
  const { week } = useProgress();
  const days = week?.streak ?? 0;
  const current = week ?? emptyWeek(now);
  const { bars, learnedToday, stars } = weekBars(current.days, current.today);
  let sentence = t("hero-start");
  if (learnedToday) {
    sentence = t("hero-kept", { days });
  } else if (days > 0) {
    sentence = t("hero-keep", { days });
  }
  return (
    <section>
      <Card className="gap-0 py-0" size="sm">
        <div className="flex min-w-0 flex-col gap-0.5 p-4">
          <h2 className="truncate text-xl font-medium tracking-tight">
            {t("greeting", { name: Option.getOrElse(name, () => t("guest")) })}
          </h2>
          <p className="text-muted-foreground truncate">{sentence}</p>
        </div>
        <div className="@container border-t p-4">
          <div className="flex flex-col gap-4 @2xl:flex-row @2xl:items-center">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <div
                className="-ms-3 flex shrink-0 items-end"
                onPointerDown={() => {
                  if (!still) {
                    fan.start({
                      scale: [1, 1.18, 1],
                      transition: { duration: 0.5, ease: [0.23, 1, 0.32, 1] },
                    });
                  }
                }}
              >
                <Nina act="fanning" label="" size={76} whole />
                <LazyMotion features={domAnimation} strict>
                  <m.div
                    animate={fan}
                    className="flex size-14 origin-bottom items-end"
                  >
                    <Flame
                      className="max-h-full max-w-full"
                      stage={tierOf(days)}
                    />
                  </m.div>
                </LazyMotion>
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate font-medium">
                  {t("streak", { days })}
                </span>
                <span className="text-muted-foreground truncate text-sm">
                  {t("week-stars", { stars })}
                </span>
              </div>
            </div>
            {bars.length === 0 ? null : (
              <ol className="flex min-w-0 gap-1 @2xl:w-80 @2xl:shrink-0">
                {Arr.map(bars, (bar) => (
                  <WeekDay bar={bar} key={bar.day} />
                ))}
              </ol>
            )}
          </div>
        </div>
        {wide ? null : (
          <footer className="flex items-center gap-3 border-t p-4">
            <LevelMeter className="flex-1" named />
            <Button onClick={showSheet} variant="outline">
              {tProgress("title")}
            </Button>
          </footer>
        )}
      </Card>
    </section>
  );
}
