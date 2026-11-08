import { buttonVariants } from "@repo/design-system/lib/button";
import { cva } from "class-variance-authority";
import { cn } from "cn";

type ButtonVariantOptions = NonNullable<Parameters<typeof buttonVariants>[0]>;

/**
 * The frame of one choice option, as the player draws it and as the exam editor's paper draws it: the
 * surface of a button in the variant of the option's state, with the text's own size and wrapping, so a
 * long option takes the height it needs. Its parts stand from the top, so the circle stays on the first line
 * of an answer that wraps. Its text stands on the side the set reads from, whatever each line of it is
 * written in, so an Arabic word in a Latin set stays beside its circle.
 */
export const choiceFrame = (
  variant: NonNullable<ButtonVariantOptions["variant"]>
) =>
  cn(
    buttonVariants({ variant }),
    "h-auto min-w-0 items-start text-base font-normal whitespace-normal ltr:text-left rtl:text-right"
  );

/** The room of an option's circle: one line of its answer high, so the circle stands on that line's middle. */
export const choiceMark = cva("flex h-lh shrink-0 items-center");
