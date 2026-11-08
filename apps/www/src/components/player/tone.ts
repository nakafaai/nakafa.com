import type { MarkedLine } from "@repo/design-system/components/ui/line";
import { Schema } from "effect";
import type { ComponentProps } from "react";

/** The tone of an answer's marked line: open, chosen, correct or wrong. */
type ChoiceTone = NonNullable<ComponentProps<typeof MarkedLine>["tone"]>;

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

/** The tone of an answer after its correctness is authorized. */
export function getChoiceReviewedTone({
  checked,
  isCorrect,
}: {
  checked: boolean;
  isCorrect: boolean | undefined;
}): ChoiceTone {
  if (checked && !isCorrect) {
    return "wrong";
  }

  if (isCorrect) {
    return "correct";
  }

  return "idle";
}
