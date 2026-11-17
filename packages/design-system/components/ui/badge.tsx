import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";

const badgeVariants = cva(
  "focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-md border px-2 py-0.5 text-xs whitespace-nowrap transition-[color,box-shadow] focus-visible:ring-3 [&>svg]:pointer-events-none [&>svg]:size-3",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground border-transparent [a&]:hover:bg-[color-mix(in_oklab,var(--primary)_99%,var(--background))] [a&]:hover:shadow-sm",
        "default-subtle":
          "border-primary text-foreground bg-[color-mix(in_oklab,var(--primary)_5%,var(--background))] [a&]:hover:bg-[color-mix(in_oklab,var(--primary)_8%,var(--background))] [a&]:hover:shadow-sm",
        "default-outline":
          "border-border bg-primary text-primary-foreground [a&]:hover:bg-[color-mix(in_oklab,var(--primary)_99%,var(--background))] [a&]:hover:shadow-sm",
        secondary:
          "bg-secondary text-secondary-foreground border-transparent [a&]:hover:bg-[color-mix(in_oklab,var(--secondary)_99%,var(--background))] [a&]:hover:shadow-sm",
        "secondary-subtle":
          "border-muted-foreground text-foreground bg-[color-mix(in_oklab,var(--secondary)_5%,var(--background))] [a&]:hover:bg-[color-mix(in_oklab,var(--secondary)_8%,var(--background))] [a&]:hover:shadow-sm",
        "secondary-outline":
          "border-border bg-secondary text-secondary-foreground [a&]:hover:bg-[color-mix(in_oklab,var(--secondary)_99%,var(--background))] [a&]:hover:shadow-sm",
        muted:
          "bg-muted text-muted-foreground [a&]:hover:bg-muted/90 border-transparent [a&]:hover:shadow-sm",
        "muted-outline":
          "border-border bg-muted text-muted-foreground [a&]:hover:bg-muted/90 [a&]:hover:shadow-sm",
        "muted-subtle":
          "border-muted-foreground text-foreground bg-[color-mix(in_oklab,var(--muted)_5%,var(--background))] [a&]:hover:bg-[color-mix(in_oklab,var(--muted)_20%,var(--background))] [a&]:hover:shadow-sm",
        destructive:
          "bg-destructive text-destructive-foreground border-transparent [a&]:hover:bg-[color-mix(in_oklab,var(--destructive)_99%,var(--background))] [a&]:hover:shadow-sm",
        "destructive-subtle":
          "border-destructive text-foreground [&>svg]:text-destructive bg-[color-mix(in_oklab,var(--destructive)_5%,var(--background))] [a&]:hover:bg-[color-mix(in_oklab,var(--destructive)_8%,var(--background))] [a&]:hover:shadow-sm",
        "destructive-outline":
          "border-border bg-destructive text-destructive-foreground [a&]:hover:bg-[color-mix(in_oklab,var(--destructive)_99%,var(--background))] [a&]:hover:shadow-sm",
        outline:
          "text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
        // The tones of a status, each from its colour token of the theme.
        success:
          "bg-success text-success-foreground border-transparent [a&]:hover:shadow-sm",
        warning:
          "bg-warning text-warning-foreground border-transparent [a&]:hover:shadow-sm",
        info: "bg-info text-info-foreground border-transparent [a&]:hover:shadow-sm",
        // A status tone as a tint: its border and icon in the tone, its words in the page's text, so no status reads as
        // a filled button, the primary's look, in a theme whose info stands near its primary.
        "success-subtle":
          "border-success text-foreground [&>svg]:text-success bg-[color-mix(in_oklab,var(--success)_8%,var(--background))] [a&]:hover:shadow-sm",
        "warning-subtle":
          "border-warning text-foreground [&>svg]:text-warning bg-[color-mix(in_oklab,var(--warning)_8%,var(--background))] [a&]:hover:shadow-sm",
        "info-subtle":
          "border-info text-foreground [&>svg]:text-info bg-[color-mix(in_oklab,var(--info)_8%,var(--background))] [a&]:hover:shadow-sm",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

/**
 * A short label of a status or a kind, in a word or two. The `-subtle` and `-outline` variants tint a status without
 * a fill; a status badge always carries a word, since a colour alone says nothing to everyone.
 */
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

export { Badge };
