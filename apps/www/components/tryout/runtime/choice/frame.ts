import { buttonVariants } from "@repo/design-system/lib/button";
import { cn } from "cn";

type ButtonVariantOptions = NonNullable<Parameters<typeof buttonVariants>[0]>;

/**
 * The frame of one choice option, as the player draws it and as the exam editor's paper draws it: the
 * surface of a button in the variant of the option's state, with the text's own size and wrapping, so a
 * long option takes the height it needs.
 */
export const choiceFrame = (
  variant: NonNullable<ButtonVariantOptions["variant"]>
) =>
  cn(
    buttonVariants({ variant }),
    "h-auto min-w-0 whitespace-normal text-left font-normal text-base"
  );
