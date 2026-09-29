import { Card, CardFooter } from "@repo/design-system/components/ui/card";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import type { ComponentProps } from "react";

const cardSectionVariants = cva("has-data-[slot=card-footer]:pb-0", {
  defaultVariants: {
    variant: "default",
  },
  variants: {
    variant: {
      default: "",
      destructive: "ring-destructive",
    },
  },
});

/**
 * A titled card that frames one self-contained section. Compose the design
 * system's card header, title, description, and content inside it, then end
 * with `CardSectionFooter` when the section has actions.
 */
export function CardSection({
  className,
  variant = "default",
  ...props
}: ComponentProps<typeof Card> & VariantProps<typeof cardSectionVariants>) {
  return (
    <Card
      className={cn(cardSectionVariants({ variant }), className)}
      data-variant={variant}
      {...props}
    />
  );
}

/** Holds a section's actions in a bar that follows its section variant. */
export function CardSectionFooter({
  className,
  ...props
}: ComponentProps<typeof CardFooter>) {
  return (
    <CardFooter
      className={cn(
        "border-t bg-muted/20 py-3 group-data-[variant=destructive]/card:border-destructive group-data-[variant=destructive]/card:bg-destructive/20 [.border-t]:pt-3",
        className
      )}
      {...props}
    />
  );
}
