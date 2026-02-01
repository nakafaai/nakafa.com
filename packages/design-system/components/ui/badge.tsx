import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cn } from "@repo/design-system/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden whitespace-nowrap rounded-md border px-2 py-0.5 font-medium text-xs transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground [a&]:hover:bg-primary/90",
        "default-subtle":
          "border-primary bg-primary/10 text-primary [a&]:hover:bg-primary/20",
        "default-outline":
          "border-border bg-primary text-primary-foreground [a&]:hover:bg-primary/90",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90",
        "secondary-subtle":
          "border-secondary bg-secondary/10 text-secondary [a&]:hover:bg-secondary/20",
        "secondary-outline":
          "border-border bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90",
        muted:
          "border-transparent bg-muted text-muted-foreground [a&]:hover:bg-muted/90",
        "muted-outline":
          "border-border bg-muted text-muted-foreground [a&]:hover:bg-muted/90",
        "muted-subtle":
          "border-muted bg-muted/10 text-muted [a&]:hover:bg-muted/20",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground [a&]:hover:bg-destructive/90",
        "destructive-subtle":
          "border-destructive bg-destructive/10 text-destructive [a&]:hover:bg-destructive/20",
        "destructive-outline":
          "border-border bg-destructive text-destructive-foreground [a&]:hover:bg-destructive/90",
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
