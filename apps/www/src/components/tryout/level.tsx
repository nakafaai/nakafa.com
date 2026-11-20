import {
  ChefHatIcon,
  Dumbbell01Icon,
  FireIcon,
  Leaf01Icon,
  Menu01Icon,
} from "@hugeicons/core-free-icons";
import type { SetLevel } from "@nakafa/aksara-contracts/assessment/catalog";
import { setLevelFilterValidator } from "@repo/backend/confect/tryouts/sets/query";
import type { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/design-system/components/ui/tooltip";
import { cva } from "class-variance-authority";
import { Array as Arr } from "effect";
import type { ComponentProps } from "react";
import { useTranslations } from "use-intl";

/**
 * How each level looks, calmest to strongest: easy, which already stands at the real exam's bar, then medium, hard
 * and cooked, each filling one bar more and with an icon no other level draws. The record names every level of the
 * contract, so a new level does not compile until it has its look.
 */
const LEVEL_LOOKS = {
  cooked: { bars: 4, icon: ChefHatIcon },
  easy: { bars: 1, icon: Leaf01Icon },
  hard: { bars: 3, icon: FireIcon },
  medium: { bars: 2, icon: Dumbbell01Icon },
} as const satisfies Record<
  SetLevel,
  Pick<ComponentProps<typeof HugeIcons>, "icon"> & { readonly bars: number }
>;

/** The four bars, each a step taller, so a level reads by its length before its colour. */
const BARS = [1, 2, 3, 4] as const;

const barVariants = cva("w-1 rounded-[1px]", {
  variants: {
    height: { 1: "h-1.5", 2: "h-2", 3: "h-2.5", 4: "h-3.5" },
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
 * A set's measured level as four rising bars and its name (the owner's notes of 20 Nov): the bars fill one more for
 * each level, in a colour that heats from green through yellow and orange to red, so a column of sets reads from
 * across the room by length and by colour, and the name says it for everyone. Cooked, the hottest, also names
 * itself in its red. Its tooltip says where the level stands against the real exam, so easy never reads as a
 * light set: it is the real exam's own level.
 */
export function TryoutLevel({ level }: { level: SetLevel }) {
  const t = useTranslations("Tryouts");
  const { bars } = LEVEL_LOOKS[level];

  return (
    <Tooltip>
      <TooltipTrigger
        render={<span className="inline-flex max-w-full items-end gap-2" />}
      >
        <span aria-hidden="true" className="flex h-3.5 items-end gap-0.5">
          {Arr.map(BARS, (bar) => (
            <span
              className={barVariants({
                height: bar,
                tone: bar <= bars ? level : "empty",
              })}
              key={bar}
            />
          ))}
        </span>
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
 * its name and icon.
 */
export function useLevelChoices() {
  const t = useTranslations("Tryouts");
  const tCommon = useTranslations("Common");

  return Arr.map(setLevelFilterValidator.literals, (value) =>
    value === "all"
      ? { icon: Menu01Icon, label: tCommon("all"), value }
      : { icon: LEVEL_LOOKS[value].icon, label: t(`level-${value}`), value }
  );
}
