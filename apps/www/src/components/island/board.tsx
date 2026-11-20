"use client";

import { QueryResult, useQuery } from "@confect/react";
import island from "@repo/backend/confect/_generated/refs/island";
import { PersonAvatar } from "@repo/design-system/components/ui/person";
import { cva } from "class-variance-authority";
import { Array as Arr, DateTime } from "effect";
import { useFormatter, useTranslations } from "use-intl";
import { LeadersBlank } from "@/components/island/blank";
import { HudSheet } from "@/components/island/sheet";
import { useCurrentLocale } from "@/lib/routing/link";

/** A row of the leaderboard on one grid: place, animal, name, Stars. The viewer's own row is marked. */
const rowVariants = cva(
  "col-span-full grid min-h-11 grid-cols-subgrid items-center rounded-lg px-3 py-1.5 text-sm",
  {
    variants: {
      own: { false: "", true: "bg-accent text-accent-foreground font-medium" },
    },
  }
);

/** A day of the week: its first letter over the Stars it gave, today on a quiet ground. */
const dayVariants = cva(
  "flex min-w-0 flex-col items-center gap-0.5 rounded-lg py-2",
  { variants: { today: { false: "", true: "bg-muted" } } }
);

/** The learner's week: the Stars each day gave, Monday first, and their run of days in a row. */
function Week() {
  const t = useTranslations("Island");
  const format = useFormatter();
  const locale = useCurrentLocale();
  const week = useQuery(island.queries.week, {});
  if (!QueryResult.isSuccess(week) || week.value === null) {
    return null;
  }
  const { days, streak, today } = week.value;
  return (
    <section className="flex flex-col gap-2">
      <header className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-medium">{t("week-title")}</h3>
        <p className="text-muted-foreground text-xs">
          {t("week-streak", { days: streak })}
        </p>
      </header>
      <ol className="grid grid-cols-7 gap-1">
        {Arr.map(days, (day) => {
          const date = DateTime.makeUnsafe(`${day.day}T00:00:00Z`);
          return (
            <li
              aria-label={t("week-day", {
                day: DateTime.formatUtc(date, { locale, weekday: "long" }),
                stars: format.number(day.stars),
              })}
              className={dayVariants({ today: day.day === today })}
              key={day.day}
            >
              <span
                aria-hidden="true"
                className="text-muted-foreground text-xs"
              >
                {DateTime.formatUtc(date, { locale, weekday: "narrow" })}
              </span>
              <span
                aria-hidden="true"
                className="text-sm font-medium tabular-nums"
              >
                {format.number(day.stars)}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/** The leaderboard: the learners with the most Stars, most first. */
function Leaders() {
  const t = useTranslations("Island");
  const format = useFormatter();
  const leaders = useQuery(island.queries.leaders, {});
  if (!QueryResult.isSuccess(leaders)) {
    return null;
  }
  if (leaders.value.length === 0) {
    return <LeadersBlank />;
  }
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-medium">{t("leaders-title")}</h3>
      <ol className="grid grid-cols-[auto_auto_minmax(0,1fr)_auto] gap-x-2">
        {Arr.map(leaders.value, (leader) => (
          <li className={rowVariants({ own: leader.own })} key={leader.place}>
            <span className="text-start text-xs tabular-nums opacity-70">
              {leader.place}
            </span>
            <PersonAvatar className="size-7" mascot={leader.mascot} />
            <span className="truncate">
              {leader.own ? t("you", { name: leader.name }) : leader.name}
            </span>
            <span className="text-end text-xs whitespace-nowrap tabular-nums opacity-70">
              {t("stars", { stars: format.number(leader.lifetime) })}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** The class sheet (ADR 0047, D27 and D31): the learner's own week, then the leaderboard. */
export function BoardSheet() {
  const t = useTranslations("Island");
  const tCommon = useTranslations("Common");
  return (
    <HudSheet
      description={t("class-description")}
      sheet="class"
      title={tCommon("class")}
    >
      <div className="flex flex-col gap-6">
        <Week />
        <Leaders />
      </div>
    </HudSheet>
  );
}
