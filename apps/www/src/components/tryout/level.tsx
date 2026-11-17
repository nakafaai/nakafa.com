import {
  ChefHatIcon,
  Dumbbell01Icon,
  FireIcon,
  Leaf01Icon,
  Menu01Icon,
} from "@hugeicons/core-free-icons";
import type { SetLevel } from "@nakafa/aksara-contracts/assessment/catalog";
import { setLevelFilterValidator } from "@repo/backend/confect/tryouts/sets/query";
import { Badge } from "@repo/design-system/components/ui/badge";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/design-system/components/ui/tooltip";
import { Array as Arr } from "effect";
import type { ComponentProps } from "react";
import { useTranslations } from "use-intl";

/** What a level draws: its icon. */
type LevelLook = Pick<ComponentProps<typeof HugeIcons>, "icon">;

/**
 * How each level looks, calmest to strongest: easy, which already stands at the real exam's bar, then medium, hard
 * and cooked, each with an icon no other level draws. The record names every level of the contract, so a new level
 * does not compile until it has its look.
 */
const LEVEL_LOOKS = {
  cooked: { icon: ChefHatIcon },
  easy: { icon: Leaf01Icon },
  hard: { icon: FireIcon },
  medium: { icon: Dumbbell01Icon },
} as const satisfies Record<SetLevel, LevelLook>;

/**
 * A set's measured level as an outlined badge, its icon climbing with the level. A level is a fact of the set, not a
 * state, so it takes no colour: the status tones belong to the learner's state beside it, and the primary to the
 * page's Start. Its tooltip says where the level stands against the real exam, so easy never reads as a light set: it
 * is the real exam's own level.
 */
export function TryoutLevelBadge({ level }: { level: SetLevel }) {
  const t = useTranslations("Tryouts");
  const look = LEVEL_LOOKS[level];

  return (
    <Tooltip>
      {/* The trigger wraps the badge, so the badge keeps its own slot for the cell that sizes it. */}
      <TooltipTrigger render={<span className="inline-flex max-w-full" />}>
        <Badge variant="outline">
          <HugeIcons data-icon="inline-start" icon={look.icon} />
          {t(`level-${level}`)}
        </Badge>
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
