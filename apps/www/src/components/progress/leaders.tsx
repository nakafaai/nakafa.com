import { PersonAvatar } from "@repo/design-system/components/ui/person";
import type { MascotCode } from "@repo/mascot/code";
import { cva } from "class-variance-authority";
import { Array as Arr } from "effect";
import type { ReactNode } from "react";
import { useFormatter, useTranslations } from "use-intl";
import { useProgress } from "@/components/progress/context";
import { PaneSection } from "@/components/progress/section";
import { EmptyState } from "@/components/state/empty";
import { EmptyNina } from "@/components/state/nina";
import { profileTarget } from "@/lib/profile/href";
import { TargetLink } from "@/lib/routing/link";

/** A row of a leaderboard on its list's grid: place, animal, name, value. The viewer's own row is marked. */
const rowVariants = cva(
  "col-span-full grid min-h-10 grid-cols-subgrid items-center rounded-lg px-3 py-1.5 text-sm",
  {
    variants: {
      interactive: {
        false: "",
        true: "hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring transition-colors ease-out outline-none focus-visible:ring-3",
      },
      own: { false: "", true: "bg-accent text-accent-foreground font-medium" },
    },
  }
);

/** The four aligned columns of one leaderboard row: place, avatar, name, and value. */
function LeaderRowCells({
  children,
  mascot,
  name,
  own,
  place,
}: {
  children: ReactNode;
  mascot: typeof MascotCode.Type;
  name: string;
  own: boolean;
  place: number;
}) {
  const t = useTranslations("Progress");
  const format = useFormatter();
  return (
    <>
      <span className="text-start text-xs tabular-nums opacity-70">
        {format.number(place)}
      </span>
      <PersonAvatar className="size-7" mascot={mascot} />
      <span className="truncate">{own ? t("you", { name }) : name}</span>
      <span className="text-end text-xs whitespace-nowrap tabular-nums opacity-70">
        {children}
      </span>
    </>
  );
}

/** A leaderboard: one grid, so places, animals, names and values each stand in one column. */
export function LeaderList({ children }: { children: ReactNode }) {
  return (
    <ol className="grid grid-cols-[auto_auto_minmax(0,1fr)_auto] gap-x-2">
      {children}
    </ol>
  );
}

/**
 * One learner on a leaderboard: their place, animal, first name, and what they
 * are ranked by. When their profile is open to the viewer, pressing the row
 * opens `/@username`.
 */
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
    readonly username: string | null;
  };
}) {
  return (
    <li className="col-span-full grid grid-cols-subgrid">
      {leader.username === null ? (
        <div className={rowVariants({ interactive: false, own: leader.own })}>
          <LeaderRowCells
            mascot={leader.mascot}
            name={leader.name}
            own={leader.own}
            place={leader.place}
          >
            {children}
          </LeaderRowCells>
        </div>
      ) : (
        <TargetLink
          className={rowVariants({ interactive: true, own: leader.own })}
          target={profileTarget(leader.username)}
        >
          <LeaderRowCells
            mascot={leader.mascot}
            name={leader.name}
            own={leader.own}
            place={leader.place}
          >
            {children}
          </LeaderRowCells>
        </TargetLink>
      )}
    </li>
  );
}

/** The global leaderboard: the learners with the most Stars, most first, or a friendly empty state before anyone earns Stars. */
export function LeadersSection() {
  const t = useTranslations("Progress");
  const format = useFormatter();
  const { leaders } = useProgress();
  return (
    <PaneSection title={t("leaders-title")}>
      {leaders.length === 0 ? (
        <EmptyState
          description={t("leaders-empty-description")}
          scene={<EmptyNina act="ranking" />}
          title={t("leaders-empty-title")}
        />
      ) : (
        <LeaderList>
          {Arr.map(leaders, (leader) => (
            <LeaderRow key={leader.place} leader={leader}>
              {t("stars", { stars: format.number(leader.lifetime) })}
            </LeaderRow>
          ))}
        </LeaderList>
      )}
    </PaneSection>
  );
}
