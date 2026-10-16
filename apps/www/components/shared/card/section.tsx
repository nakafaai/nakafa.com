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

const cardSectionFooterVariants = cva(
  "min-h-15 items-center justify-end gap-4 border-t bg-muted/20 py-3 group-data-[variant=destructive]/card:border-destructive group-data-[variant=destructive]/card:bg-destructive/20 [.border-t]:pt-3",
  {
    variants: {
      bottomSheet: {
        false: "",
        true: "max-md:rounded-none max-md:pb-[calc(env(safe-area-inset-bottom,0px)+--spacing(3))]",
      },
    },
  }
);

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

/**
 * Holds a section's sentence and actions in one row at every width: the
 * sentence on the left, the actions on the right. The bar is as tall with a
 * line of text alone as with a button, so every card ends the same way.
 * `bottomSheet` ends a phone's bottom sheet with square bottom corners and the
 * safe area below its actions.
 */
export function CardSectionFooter({
  bottomSheet,
  ...props
}: Omit<ComponentProps<typeof CardFooter>, "className"> &
  VariantProps<typeof cardSectionFooterVariants>) {
  return (
    <CardFooter
      className={cardSectionFooterVariants({ bottomSheet })}
      {...props}
    />
  );
}

/**
 * The one sentence that says what a section's actions do. It takes the free
 * width on the left of its footer. A caller may change only its text color.
 */
export function CardSectionHint({ className, ...props }: ComponentProps<"p">) {
  return (
    <p
      className={cn("min-w-0 flex-1 text-muted-foreground text-sm", className)}
      {...props}
    />
  );
}

/**
 * Holds a section's actions on the right of its footer, side by side at their
 * full size, so a footer with only actions keeps them on the right too.
 */
export function CardSectionActions(
  props: Omit<ComponentProps<"div">, "className">
) {
  return <div className="flex shrink-0 items-center gap-2" {...props} />;
}
