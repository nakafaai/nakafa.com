import { PersonAvatar } from "@repo/design-system/components/ui/person";
import { cva } from "class-variance-authority";
import { Array as Arr } from "effect";
import { useFormatter, useTranslations } from "use-intl";
import { useProgress } from "@/components/progress/context";
import { PaneSection } from "@/components/progress/section";

/** A row of the leaderboard on one grid: place, animal, name, Stars. The viewer's own row is marked. */
const rowVariants = cva(
  "grid h-10 grid-cols-[1.25rem_1.75rem_minmax(0,1fr)_auto] items-center gap-3 rounded-lg px-2 text-sm",
  {
    variants: {
      own: { false: "", true: "bg-accent text-accent-foreground font-medium" },
    },
  }
);

/**
 * The global leaderboard (ADR 0047, D27; the owner's home notes, 14 Nov):
 * the learners with the most Stars, most first, every row on the same grid so
 * places, animals, names and Stars each stand in one column.
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
      <ol className="-mx-2 flex flex-col">
        {Arr.map(leaders, (leader) => (
          <li className={rowVariants({ own: leader.own })} key={leader.place}>
            <span className="text-end text-xs tabular-nums opacity-70">
              {leader.place}
            </span>
            <PersonAvatar className="size-7" mascot={leader.mascot} />
            <span className="truncate">
              {leader.own ? t("you", { name: leader.name }) : leader.name}
            </span>
            <span className="text-xs tabular-nums opacity-70">
              {t("stars", { stars: format.number(leader.lifetime) })}
            </span>
          </li>
        ))}
      </ol>
    </PaneSection>
  );
}
