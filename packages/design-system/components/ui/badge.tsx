import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cn } from "@repo/design-system/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden whitespace-nowrap rounded-md border px-2 py-0.5 text-xs transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring aria-invalid:border-destructive aria-invalid:ring-destructive [&>svg]:pointer-events-none [&>svg]:size-3",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground [a&]:hover:shadow-sm",
        "default-subtle":
          "border-primary bg-primary/5 text-foreground [a&]:hover:shadow-sm",
        "default-outline":
          "border-border bg-primary text-primary-foreground [a&]:hover:shadow-sm",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground [a&]:hover:shadow-sm",
        "secondary-subtle":
          "border-muted-foreground bg-secondary/5 text-foreground [a&]:hover:shadow-sm",
        "secondary-outline":
          "border-border bg-secondary text-secondary-foreground [a&]:hover:shadow-sm",
        muted:
          "border-transparent bg-muted text-muted-foreground [a&]:hover:shadow-sm",
        "muted-outline":
          "border-border bg-muted text-muted-foreground [a&]:hover:shadow-sm",
        "muted-subtle":
          "border-muted-foreground bg-muted/5 text-foreground [a&]:hover:shadow-sm",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground [a&]:hover:shadow-sm",
        "destructive-subtle":
          "border-destructive bg-destructive/5 text-foreground [a&]:hover:shadow-sm",
        "destructive-outline":
          "border-border bg-destructive text-destructive-foreground [a&]:hover:shadow-sm",
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
