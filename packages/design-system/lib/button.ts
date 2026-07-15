import { cva } from "class-variance-authority";

/** Shared interaction, semantic, and size variants for every Nakafa button. */
export const buttonVariants = cva(
  "inline-flex shrink-0 cursor-pointer select-none items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm outline-none transition-all ease-out focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-xs hover:bg-[color-mix(in_oklch,var(--primary)_99%,var(--background))] hover:shadow-md",
        "default-outline":
          "border border-primary bg-[color-mix(in_oklch,var(--primary)_5%,var(--background))] text-foreground shadow-xs hover:bg-[color-mix(in_oklch,var(--primary)_8%,var(--background))] hover:shadow-md",
        destructive:
          "bg-destructive text-destructive-foreground shadow-xs hover:bg-[color-mix(in_oklch,var(--destructive)_99%,var(--background))] hover:shadow-md focus-visible:ring-destructive",
        "destructive-outline":
          "border border-destructive bg-[color-mix(in_oklch,var(--destructive)_5%,var(--background))] text-foreground shadow-xs hover:bg-[color-mix(in_oklch,var(--destructive)_8%,var(--background))] hover:shadow-md",
        outline:
          "border border-border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground shadow-xs hover:bg-[color-mix(in_oklch,var(--secondary)_99%,var(--background))] hover:shadow-md",
        "secondary-outline":
          "border border-muted-foreground bg-[color-mix(in_oklch,var(--secondary)_5%,var(--background))] text-foreground shadow-xs hover:bg-[color-mix(in_oklch,var(--secondary)_8%,var(--background))] hover:shadow-md",
        ghost:
          "hover:bg-accent hover:text-accent-foreground hover:[&_svg]:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 gap-1.5 rounded-md px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-9",
        "icon-sm": "size-8",
        "icon-xs": "size-6 [&_svg:not([class*='size-'])]:size-3.5",
      },
    },
    defaultVariants: {
      size: "default",
      variant: "default",
    },
  }
);
