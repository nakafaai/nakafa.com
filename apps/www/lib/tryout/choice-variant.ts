import type { buttonVariants } from "@repo/design-system/lib/button";

type ButtonVariantOptions = NonNullable<Parameters<typeof buttonVariants>[0]>;
type ButtonVariant = NonNullable<ButtonVariantOptions["variant"]>;

/** Selects the answer-option appearance while a choice remains selectable. */
export function getTryoutSelectableChoiceVariant({
  checked,
}: {
  checked: boolean;
}): ButtonVariant {
  return checked ? "default-outline" : "outline";
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
