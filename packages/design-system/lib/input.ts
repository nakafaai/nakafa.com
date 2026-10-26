import { cva } from "class-variance-authority";

/**
 * The box of every Nakafa field: its border, height, padding, focus ring, and invalid and
 * disabled states. A text input draws it, and so does the trigger of a picker, so a date
 * field reads as the field beside it.
 */
export const fieldBoxVariants = cva(
  "flex h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 md:text-sm"
);
