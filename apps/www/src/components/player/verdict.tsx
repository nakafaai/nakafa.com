import {
  Cancel01Icon,
  HourglassIcon,
  MinusSignIcon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";
import type { Verdict } from "@repo/backend/confect/assessment/verdict";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { cva } from "class-variance-authority";
import type { PlayerVerdict } from "@/components/player/model";

/**
 * How a number shows each verdict, in a finished paper's navigator and in its question's head alike, as the
 * choices of a reviewed question do: green for right, red for wrong, a quiet outline for some points or a grade
 * that waits, filled for an answer whose grade the reader may not see, and a dashed outline for no answer.
 */
export const VERDICT_VARIANT = {
  answered: "default",
  correct: "success-outline",
  incorrect: "destructive-outline",
  partial: "secondary-outline",
  pending: "secondary-outline",
  unanswered: "outline",
} as const satisfies Record<PlayerVerdict, string>;

/** What a verdict adds to its number's button look: no answer is dashed and quiet, as nothing was given. */
export const verdictNumberVariants = cva("relative", {
  variants: {
    verdict: {
      answered: "",
      correct: "",
      incorrect: "",
      partial: "",
      pending: "",
      unanswered: "text-muted-foreground border-dashed",
    },
  },
});

/** The mark a graded verdict carries on its number's corner, so no verdict relies on color alone. */
const VERDICT_MARK = {
  correct: Tick02Icon,
  incorrect: Cancel01Icon,
  partial: MinusSignIcon,
  pending: HourglassIcon,
} as const satisfies Record<Verdict, unknown>;

const verdictMarkVariants = cva(
  "ring-background absolute -end-1.5 -top-1.5 grid size-4 place-items-center rounded-full ring-2",
  {
    variants: {
      verdict: {
        correct: "bg-success text-success-foreground",
        incorrect: "bg-destructive text-destructive-foreground",
        partial: "bg-warning text-warning-foreground",
        pending: "bg-muted text-muted-foreground",
      },
    },
  }
);

/** The corner mark of a graded number: a tick, a cross, a minus for some points, or an hourglass while it waits. */
export function PlayerVerdictMark({ verdict }: { verdict: PlayerVerdict }) {
  if (verdict === "answered" || verdict === "unanswered") {
    return null;
  }
  return (
    <span aria-hidden="true" className={verdictMarkVariants({ verdict })}>
      <HugeIcons icon={VERDICT_MARK[verdict]} size="2xs" />
    </span>
  );
}
