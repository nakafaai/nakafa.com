import type { buttonVariants } from "@repo/design-system/lib/button";
import { Schema } from "effect";

type ButtonVariantOptions = NonNullable<Parameters<typeof buttonVariants>[0]>;
type ButtonVariant = NonNullable<ButtonVariantOptions["variant"]>;

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

/** Selects the answer-option appearance while a choice remains selectable. */
export function getTryoutSelectableChoiceVariant({
  checked,
}: {
  checked: boolean;
}): ButtonVariant {
  return checked ? "default-outline" : "outline";
}

/** Selects the preview appearance without replacing its interactive surface. */
export function getTryoutPreviewChoiceVariant({
  appearance,
  checked,
}: {
  appearance: TryoutPreviewChoiceAppearance;
  checked: boolean;
}): ButtonVariant {
  if (appearance.kind === "selectable") {
    return getTryoutSelectableChoiceVariant({ checked });
  }

  return getTryoutReviewedChoiceVariant({
    checked,
    isCorrect: appearance.isCorrect,
  });
}

/** Selects the answer-option appearance after correctness is authorized. */
export function getTryoutReviewedChoiceVariant({
  checked,
  isCorrect,
}: {
  checked: boolean;
  isCorrect: boolean | undefined;
}): ButtonVariant {
  if (checked && !isCorrect) {
    return "destructive-outline";
  }

  if (isCorrect) {
    return "success-outline";
  }

  return "outline";
}
