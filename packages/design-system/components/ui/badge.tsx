import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cn } from "@repo/design-system/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden whitespace-nowrap rounded-md border px-2 py-0.5 text-xs transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 [&>svg]:pointer-events-none [&>svg]:size-3",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground [a&]:hover:bg-[color-mix(in_oklch,var(--primary)_99%,var(--background))] [a&]:hover:shadow-sm",
        "default-subtle":
          "border-primary bg-[color-mix(in_oklch,var(--primary)_5%,var(--background))] text-foreground [a&]:hover:bg-[color-mix(in_oklch,var(--primary)_8%,var(--background))] [a&]:hover:shadow-sm",
        "default-outline":
          "border-border bg-primary text-primary-foreground [a&]:hover:bg-[color-mix(in_oklch,var(--primary)_99%,var(--background))] [a&]:hover:shadow-sm",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground [a&]:hover:bg-[color-mix(in_oklch,var(--secondary)_99%,var(--background))] [a&]:hover:shadow-sm",
        "secondary-subtle":
          "border-muted-foreground bg-[color-mix(in_oklch,var(--secondary)_5%,var(--background))] text-foreground [a&]:hover:bg-[color-mix(in_oklch,var(--secondary)_8%,var(--background))] [a&]:hover:shadow-sm",
        "secondary-outline":
          "border-border bg-secondary text-secondary-foreground [a&]:hover:bg-[color-mix(in_oklch,var(--secondary)_99%,var(--background))] [a&]:hover:shadow-sm",
        muted:
          "border-transparent bg-muted text-muted-foreground [a&]:hover:bg-muted/90 [a&]:hover:shadow-sm",
        "muted-outline":
          "border-border bg-muted text-muted-foreground [a&]:hover:bg-muted/90 [a&]:hover:shadow-sm",
        "muted-subtle":
          "border-muted-foreground bg-[color-mix(in_oklch,var(--muted)_5%,var(--background))] text-foreground [a&]:hover:bg-[color-mix(in_oklch,var(--muted)_20%,var(--background))] [a&]:hover:shadow-sm",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground [a&]:hover:bg-[color-mix(in_oklch,var(--destructive)_99%,var(--background))] [a&]:hover:shadow-sm",
        "destructive-subtle":
          "border-destructive bg-[color-mix(in_oklch,var(--destructive)_5%,var(--background))] text-foreground [a&]:hover:bg-[color-mix(in_oklch,var(--destructive)_8%,var(--background))] [a&]:hover:shadow-sm",
        "destructive-outline":
          "border-border bg-destructive text-destructive-foreground [a&]:hover:bg-[color-mix(in_oklch,var(--destructive)_99%,var(--background))] [a&]:hover:shadow-sm",
        outline:
          "text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ className, variant })),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  });
}

export { Badge, badgeVariants };
