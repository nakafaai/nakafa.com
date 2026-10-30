import { cva } from "class-variance-authority";

/** Shared visual variants for standalone toggles and toggle-group items. */
export const toggleVariants = cva(
  "pressable hover:bg-muted hover:text-muted-foreground focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 data-pressed:bg-accent data-pressed:text-accent-foreground dark:aria-invalid:ring-destructive/40 inline-flex items-center justify-center gap-2 rounded-md text-sm whitespace-nowrap transition-[scale,color,box-shadow] outline-none focus-visible:ring-3 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-transparent",
        outline:
          "border-input hover:bg-accent hover:text-accent-foreground border bg-transparent shadow-xs",
      },
      size: {
        default: "h-9 min-w-9 px-2",
        sm: "h-8 min-w-8 px-1.5",
        lg: "h-10 min-w-10 px-2.5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);
