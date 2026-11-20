import { PersonAvatar } from "@repo/design-system/components/ui/person";
import type { MascotCode } from "@repo/mascot/code";
import { cva } from "class-variance-authority";
import { Array as Arr } from "effect";
import type { ReactNode } from "react";
import { useFormatter, useTranslations } from "use-intl";
import { useProgress } from "@/components/progress/context";
import { PaneSection } from "@/components/progress/section";

/** A row of a leaderboard on its list's grid: place, animal, name, value. The viewer's own row is marked. */
const rowVariants = cva(
  "col-span-full grid min-h-10 grid-cols-subgrid items-center rounded-lg px-3 py-1.5 text-sm",
  {
    variants: {
      own: { false: "", true: "bg-accent text-accent-foreground font-medium" },
    },
  }
);

/** A leaderboard: one grid, so places, animals, names and values each stand in one column. */
export function LeaderList({ children }: { children: ReactNode }) {
  return (
    <ol className="grid grid-cols-[auto_auto_minmax(0,1fr)_auto] gap-x-2">
      {children}
    </ol>
  );
}

/** One learner on a leaderboard: their place, animal and first name, and what they are ranked by. */
export function LeaderRow({
  children,
  leader,
}: {
  /** What the learner is ranked by, such as their Stars or their score. */
  children: ReactNode;
  leader: {
    readonly mascot: typeof MascotCode.Type;
    readonly name: string;
    readonly own: boolean;
    readonly place: number;
  };
}) {
  const t = useTranslations("Island");
  const format = useFormatter();
  return (
    <li className={rowVariants({ own: leader.own })}>
      <span className="text-start text-xs tabular-nums opacity-70">
        {format.number(leader.place)}
      </span>
      <PersonAvatar className="size-7" mascot={leader.mascot} />
      <span className="truncate">
        {leader.own ? t("you", { name: leader.name }) : leader.name}
      </span>
      <span className="text-end text-xs whitespace-nowrap tabular-nums opacity-70">
        {children}
      </span>
    </li>
  );
}

/**
 * The global leaderboard (ADR 0047, D27; the owner's home notes, 14 Nov):
 * the learners with the most Stars, most first.
 */
export function LeadersSection() {
  const t = useTranslations("Island");
  const format = useFormatter();
  const { leaders } = useProgress();
  if (leaders.length === 0) {
    return null;
  }
  return (
    <PaneSection title={t("leaders-title")}>
      <LeaderList>
        {Arr.map(leaders, (leader) => (
          <LeaderRow key={leader.place} leader={leader}>
            {t("stars", { stars: format.number(leader.lifetime) })}
          </LeaderRow>
        ))}
      </LeaderList>
    </PaneSection>
  );
}
