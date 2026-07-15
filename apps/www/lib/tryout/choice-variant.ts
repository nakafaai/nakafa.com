import type { buttonVariants } from "@repo/design-system/lib/button";

type ButtonVariantOptions = NonNullable<Parameters<typeof buttonVariants>[0]>;
type ButtonVariant = NonNullable<ButtonVariantOptions["variant"]>;

interface TryoutChoiceVariantInput {
  checked: boolean;
  isCorrect: boolean | undefined;
  reviewMode: boolean;
}

/** Selects the answer-option appearance for active and completed tryouts. */
export function getTryoutChoiceVariant({
  checked,
  isCorrect,
  reviewMode,
}: TryoutChoiceVariantInput): ButtonVariant {
  if (!reviewMode) {
    return checked ? "default-outline" : "outline";
  }

  if (checked && !isCorrect) {
    return "destructive-outline";
  }

  if (isCorrect) {
    return "success-outline";
  }

  return "outline";
}
