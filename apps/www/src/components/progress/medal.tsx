import { Medal } from "@repo/design-system/components/ui/medal";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/design-system/components/ui/tooltip";
import { cva } from "class-variance-authority";
import type { ReactNode } from "react";
import { useTranslations } from "use-intl";
import type { wallOf } from "@/components/progress/level";

type WallMedal = ReturnType<typeof wallOf>[number];

/** The five kinds of learning, whose medals have a name of their own; a subject's medal takes the subject's name. */
const KIND_NAMES = {
  days: "badge-days",
  lessons: "badge-lessons",
  sections: "badge-sections",
  sets: "badge-sets",
  streak: "badge-streak",
} as const;

/** What a medal counts, said when a reader rests on it. */
const KIND_HINTS = {
  days: "badge-days-hint",
  lessons: "badge-lessons-hint",
  sections: "badge-sections-hint",
  sets: "badge-sets-hint",
  streak: "badge-streak-hint",
} as const;

/** The width a medal is drawn at. */
const medalVariants = cva("", {
  variants: { size: { large: "w-16", small: "w-12" } },
});

/** Whether a medal is one of the five kinds of learning. */
function isKind(name: WallMedal["name"]): name is keyof typeof KIND_NAMES {
  return name in KIND_NAMES;
}

/**
 * One medal with one line for its name (ADR 0047, D30). Its stars, metal and
 * rim say its tier, and resting on it says what it counts and how far the next
 * tier is, as a game's badges do, so the wall itself stays quiet.
 */
export function MedalItem({
  children,
  medal,
  size = "small",
}: {
  /** What stands under the name, such as the way to the next tier on a profile. */
  children?: ReactNode;
  medal: WallMedal;
  /** How large the medal is drawn: small in the pane's row, large on a profile's wall. */
  size?: "large" | "small";
}) {
  const t = useTranslations("Island");
  const tSubject = useTranslations("Subject");
  return (
    <li className="min-w-0">
      <Tooltip>
        <TooltipTrigger
          render={
            <span className="text-muted-foreground flex min-w-0 flex-col items-center gap-1.5" />
          }
        >
          <Medal
            className={medalVariants({ size })}
            name={medal.name}
            tier={medal.tier}
          />
          <span className="text-foreground w-full truncate text-center text-xs font-medium">
            {isKind(medal.name)
              ? t(KIND_NAMES[medal.name])
              : tSubject(medal.name)}
          </span>
          {children}
        </TooltipTrigger>
        <TooltipContent>
          {t(
            isKind(medal.name) ? KIND_HINTS[medal.name] : "badge-lessons-hint",
            { count: medal.count, next: medal.next }
          )}
        </TooltipContent>
      </Tooltip>
    </li>
  );
}
