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
