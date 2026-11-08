import type { MarkedLine } from "@repo/design-system/components/ui/line";
import { Schema } from "effect";
import type { ComponentProps } from "react";

/** The tone of an answer's marked line: open, chosen, correct or wrong. */
type ChoiceTone = NonNullable<ComponentProps<typeof MarkedLine>["tone"]>;

const TryoutPreviewChoiceAppearanceSchema = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal("selectable"),
  }),
  Schema.Struct({
    isCorrect: Schema.UndefinedOr(Schema.Boolean),
    kind: Schema.Literal("revealed"),
  }),
]);

export type TryoutPreviewChoiceAppearance =
  typeof TryoutPreviewChoiceAppearanceSchema.Type;

/** The tone of an answer while it stays answerable, or once a demo reveals its key. */
export function getTryoutPreviewChoiceTone({
  appearance,
  checked,
}: {
  appearance: TryoutPreviewChoiceAppearance;
  checked: boolean;
}): ChoiceTone {
  if (appearance.kind === "selectable") {
    return checked ? "chosen" : "idle";
  }

  return getTryoutReviewedChoiceTone({
    checked,
    isCorrect: appearance.isCorrect,
  });
}

/** The tone of an answer after its correctness is authorized. */
export function getTryoutReviewedChoiceTone({
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
