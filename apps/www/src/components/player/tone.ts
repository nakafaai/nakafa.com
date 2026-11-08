import { Cancel01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import type { MarkedLine } from "@repo/design-system/components/ui/line";
import { Match, Option, Schema } from "effect";
import type { ComponentProps } from "react";

/** The tone of an answer's marked line: open, chosen, correct, wrong, or the key the learner did not pick. */
type ChoiceTone = Exclude<
  NonNullable<ComponentProps<typeof MarkedLine>["tone"]>,
  "bare"
>;

const ChoiceAppearanceSchema = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal("selectable"),
  }),
  Schema.Struct({
    isCorrect: Schema.UndefinedOr(Schema.Boolean),
    kind: Schema.Literal("revealed"),
  }),
]);

export type ChoiceAppearance = typeof ChoiceAppearanceSchema.Type;

/** The tone of an answer while it stays answerable, or once a demo reveals its key. */
export function choiceTone({
  appearance,
  checked,
}: {
  appearance: ChoiceAppearance;
  checked: boolean;
}): ChoiceTone {
  if (appearance.kind === "selectable") {
    return checked ? "chosen" : "idle";
  }

  return getChoiceReviewedTone({
    checked,
    isCorrect: appearance.isCorrect,
  });
}

/**
 * The tone of an answer, an option or a table's cell, after its correctness is authorized: the learner's pick
 * that earns the key, a pick that misses it, the key the learner did not pick, which is dashed so it never reads
 * as a pick, or open.
 */
export function getChoiceReviewedTone({
  checked,
  isCorrect,
}: {
  checked: boolean;
  isCorrect: boolean | undefined;
}): ChoiceTone {
  if (isCorrect) {
    return checked ? "correct" : "key";
  }

  return checked ? "wrong" : "idle";
}

/**
 * The mark at the end of an answer's line, the same on an option and on a table's cell: a check on the key, picked
 * or not, a cross on a pick that misses it, and none on an open answer.
 */
export const toneMark = (tone: ChoiceTone) =>
  Match.value(tone).pipe(
    Match.when(Match.is("correct", "key"), () => Option.some(Tick02Icon)),
    Match.when("wrong", () => Option.some(Cancel01Icon)),
    Match.orElse(() => Option.none())
  );
