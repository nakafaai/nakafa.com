import type { Ref } from "@confect/core";
import type island from "@repo/backend/confect/_generated/refs/island";
import { Array as Arr } from "effect";
import type { CSSProperties } from "react";
import { useTranslations } from "use-intl";
import { medalsOf } from "@/components/progress/level";
import { MedalItem } from "@/components/progress/medal";

type Medals = NonNullable<Ref.Returns<typeof island.queries.medals>>;
type ProfileMedal = ReturnType<typeof medalsOf>[number];

/** How far a medal is toward its next tier: a thin bar in the Stars' yellow, and the count against the next one. */
function MedalWay({ medal }: { medal: ProfileMedal }) {
  const fill: CSSProperties = { "--share": medal.share };
  return (
    <span className="flex w-full flex-col items-center gap-1">
      <span className="bg-muted h-1 w-12 overflow-hidden rounded-full">
        <span
          className="bg-pop-yellow block h-full w-[calc(var(--share)*100%)] rounded-full"
          style={fill}
        />
      </span>
      <span className="text-xs tabular-nums">
        {medal.count} / {medal.next}
      </span>
    </span>
  );
}

/**
 * The Badges tab of a profile (the owner's home notes, 14 Nov): the learner's
 * level, how many medals they hold, and every medal there is, earned or still
 * a silhouette, each with its way to the next tier. It is the wall a learner
 * shows to other people, so the home's pane only keeps their best four.
 */
export function UserBadges({ medals }: { medals: Medals }) {
  const t = useTranslations("Island");
  const wall = medalsOf(medals.tally);
  return (
    <section className="flex flex-col gap-6 pt-6">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="truncate font-medium">
          {t("level", { level: medals.level })}
        </h2>
        <span className="text-muted-foreground shrink-0 text-sm tabular-nums">
          {t("badges-count", {
            earned: Arr.reduce(wall, 0, (sum, medal) => sum + medal.tier),
          })}
        </span>
      </div>
      <ul className="grid grid-cols-3 gap-x-3 gap-y-6 sm:grid-cols-4 md:grid-cols-6">
        {Arr.map(wall, (medal) => (
          <MedalItem key={medal.name} medal={medal} size="large">
            <MedalWay medal={medal} />
          </MedalItem>
        ))}
      </ul>
    </section>
  );
}
