import { cva } from "class-variance-authority";

/**
 * The box of every Nakafa field: its border, height, padding, focus ring, and invalid and
 * disabled states. A text input draws it, and so does the trigger of a picker, so a date
 * field reads as the field beside it. Its text is 16px on every touch screen, a tablet's too, since iOS zooms the
 * page into a field written smaller, and 14px only from a wide screen with a mouse.
 */
export const fieldBoxVariants = cva(
  "border-input focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 flex h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-3 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:pointer-fine:text-sm"
);
