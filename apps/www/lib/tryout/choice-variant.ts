import type { buttonVariants } from "@repo/design-system/lib/button";

type ButtonVariantOptions = NonNullable<Parameters<typeof buttonVariants>[0]>;
type ButtonVariant = NonNullable<ButtonVariantOptions["variant"]>;

export type TryoutPreviewChoiceAppearance =
  | { readonly kind: "selectable" }
  | {
      readonly isCorrect: boolean | undefined;
      readonly kind: "revealed";
    };

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
