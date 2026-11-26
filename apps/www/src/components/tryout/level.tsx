import { Menu01Icon } from "@hugeicons/core-free-icons";
import type { SetLevel } from "@nakafa/aksara-contracts/assessment/catalog";
import { setLevelFilterValidator } from "@repo/backend/confect/tryouts/sets/query";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/design-system/components/ui/tooltip";
import type { VariantProps } from "class-variance-authority";
import { cva } from "class-variance-authority";
import { Array as Arr } from "effect";
import { useTranslations } from "use-intl";

/**
 * How many of the four bars each level fills, calmest to strongest: easy, which already stands at the real exam's bar,
 * then medium, hard and cooked. The record names every level of the contract, so a new level does not compile until it
 * has its look.
 */
const LEVEL_BARS = {
  cooked: 4,
  easy: 1,
  hard: 3,
  medium: 2,
} as const satisfies Record<SetLevel, number>;

/** The four bars, each a step taller, so a level reads by its length before its colour. */
const BARS = [1, 2, 3, 4] as const;

/**
 * The box of a level's bars: beside its name in a cell, or in an icon's square in a menu, where the bars stand
 * narrower so all four fit `size-4` as every other option's icon does.
 */
const barsVariants = cva("flex shrink-0 items-end gap-0.5", {
  defaultVariants: { size: "cell" },
  variants: {
    size: { cell: "h-3.5", icon: "size-4 justify-center py-px" },
  },
});

const barVariants = cva("rounded-[1px]", {
  defaultVariants: { size: "cell" },
  variants: {
    height: { 1: "h-1.5", 2: "h-2", 3: "h-2.5", 4: "h-3.5" },
    size: { cell: "w-1", icon: "w-0.5" },
    tone: {
      cooked: "bg-pop-red",
      easy: "bg-pop-green",
      empty: "bg-muted-foreground/30",
      hard: "bg-pop-orange",
      medium: "bg-pop-yellow",
    },
  },
});

const levelNameVariants = cva("text-sm leading-3.5", {
  variants: {
    level: {
      cooked: "text-pop-red font-medium",
      easy: "",
      hard: "",
      medium: "",
    },
  },
});

/**
 * A level's four rising bars, the one mark of a level wherever it stands: the bars fill one more for each level, in a
 * colour that heats from green through yellow and orange to red. The table's cell and the level column's filter draw
 * the same mark, so a learner who picks a level in the menu sees the bars its rows show.
 */
function LevelBars({
  level,
  size,
}: VariantProps<typeof barsVariants> & { level: SetLevel }) {
  return (
    <span aria-hidden="true" className={barsVariants({ size })}>
      {Arr.map(BARS, (bar) => (
        <span
          className={barVariants({
            height: bar,
            size,
            tone: bar <= LEVEL_BARS[level] ? level : "empty",
          })}
          key={bar}
        />
      ))}
    </span>
  );
}

/**
 * A set's measured level as four rising bars and its name (the owner's notes of 20 Nov), so a column of sets reads
 * from across the room by length and by colour, and the name says it for everyone. Cooked, the hottest, also names
 * itself in its red. Its tooltip says where the level stands against the real exam, so easy never reads as a light
 * set: it is the real exam's own level.
 */
export function TryoutLevel({ level }: { level: SetLevel }) {
  const t = useTranslations("Tryouts");

  return (
    <Tooltip>
      <TooltipTrigger
        render={<span className="inline-flex max-w-full items-end gap-2" />}
      >
        <LevelBars level={level} />
        <span className={levelNameVariants({ level })}>
          {t(`level-${level}`)}
        </span>
      </TooltipTrigger>
      <TooltipContent>{t(`level-${level}-bar`)}</TooltipContent>
    </Tooltip>
  );
}

/**
 * The values a level column's head filters by: every level first, then the levels in the contract's order, each with
 * its name and the bars its rows draw.
 */
export function useLevelChoices() {
  const t = useTranslations("Tryouts");
  const tCommon = useTranslations("Common");

  return Arr.map(setLevelFilterValidator.literals, (value) =>
    value === "all"
      ? { icon: Menu01Icon, label: tCommon("all"), value }
      : {
          icon: <LevelBars level={value} size="icon" />,
          label: t(`level-${value}`),
          value,
        }
  );
}
