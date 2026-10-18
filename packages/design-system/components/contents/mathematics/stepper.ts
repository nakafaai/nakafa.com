import { cva } from "class-variance-authority";

/**
 * The frame of a number stepper, which holds its field and its two step buttons.
 * The lab draws its stepper in this frame, and the static card draws an empty
 * one, so both are the same height. The frame is a flex box, so a line box of its
 * parent never adds to its height.
 */
export const stepperVariants = cva(
  "relative flex h-9 w-full items-center overflow-hidden whitespace-nowrap rounded-md border border-input text-sm shadow-xs outline-none transition-[color,box-shadow] data-focus-within:border-ring data-disabled:opacity-50 data-focus-within:ring-3 data-focus-within:ring-ring/50 data-focus-within:has-aria-invalid:border-destructive data-focus-within:has-aria-invalid:ring-destructive/20 dark:data-focus-within:has-aria-invalid:ring-destructive/40"
);
