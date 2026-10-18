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
  "@container/card-footer min-h-15 shrink-0 flex-wrap items-center justify-end gap-x-4 gap-y-3 border-t bg-muted/20 py-3 group-data-[variant=destructive]/card:border-destructive group-data-[variant=destructive]/card:bg-destructive/20 [.border-t]:pt-3",
  {
    variants: {
      bottomSheet: {
        false: "",
        true: "max-md:rounded-none max-md:pb-[calc(env(safe-area-inset-bottom,0px)+--spacing(3))]",
      },
    },
  }
);

const cardSectionHintVariants = cva("me-auto max-w-xl flex-1 text-sm", {
  defaultVariants: {
    tone: "muted",
  },
  variants: {
    tone: {
      destructive: "text-destructive",
      muted: "text-muted-foreground",
    },
  },
});

// In a footer narrower than the built-in `@3xs` container size, an action drops its
// icon, except a spinner, which shows progress. Its label wraps between words only,
// and it shares the row with the other actions, wrapping onto its own line when their
// labels cannot share one. A footer with no sentence gives its actions the whole row.
// `min-h-8` keeps the small size's height as the floor of a one-line label, and
// `min-w-fit` keeps each action as wide as its label needs, up to the room it has.
const cardSectionActionsVariants = cva(
  "@max-3xs/card-footer:*:wrap-normal flex flex-wrap items-center justify-end gap-2 @max-3xs/card-footer:*:h-auto @max-3xs/card-footer:*:min-h-8 @max-3xs/card-footer:*:min-w-fit @max-3xs/card-footer:*:flex-1 @max-3xs/card-footer:*:whitespace-normal @max-3xs/card-footer:[&_svg:not(.animate-spin)]:hidden",
  {
    defaultVariants: {
      share: false,
    },
    variants: {
      share: {
        false: "@max-3xs/card-footer:only:w-full",
        true: "flex-1 *:flex-1",
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
 * Holds a section's sentence and actions in one row, the sentence on the left
 * and the actions on the right. When the two cannot share the row, the actions
 * move to the next line, end-aligned. The bar is as tall with a line of text
 * alone as with a button, so every card ends the same way. It never shrinks: in
 * a card with a height limit the body scrolls and the actions stay whole. The
 * footer is a size container, so its actions can adapt to a narrow row.
 * `bottomSheet` ends a phone's bottom sheet with square bottom corners and the
 * safe area below its actions.
 */
export function CardSectionFooter({
  bottomSheet,
  ...props
}: Omit<ComponentProps<typeof CardFooter>, "className"> &
  VariantProps<typeof cardSectionFooterVariants>) {
  // The layout class comes after the spread, so no prop can replace it.
  return (
    <CardFooter
      {...props}
      className={cardSectionFooterVariants({ bottomSheet })}
    />
  );
}

/**
 * The one sentence that says what a section's actions do, or what stops them.
 * It takes the free width on the left of its footer, and its words wrap within
 * it. It starts at the footer's left edge even when no action sits beside it,
 * because the footer packs its actions to the right. Its tone is the only
 * styling a caller chooses.
 */
export function CardSectionHint({
  tone,
  ...props
}: Omit<ComponentProps<"p">, "className"> &
  VariantProps<typeof cardSectionHintVariants>) {
  // The text class comes after the spread, so no prop can replace it.
  return <p {...props} className={cardSectionHintVariants({ tone })} />;
}

/**
 * Holds a section's actions on the right of its footer, side by side at their
 * full size, so a footer with only actions keeps them on the right too. When
 * they have no room beside the sentence, they move to their own line and wrap
 * among their buttons. In a footer narrower than the built-in `@3xs` container
 * size, each action drops its icon, except a spinner, and wraps its label between
 * words. The actions share the row, and with no sentence beside them they fill
 * it. A footer with no sentence passes `share`: its actions split the row
 * equally, and when their labels do not fit side by side they stack, each across
 * the full width.
 */
export function CardSectionActions({
  share,
  ...props
}: Omit<ComponentProps<"div">, "className"> &
  VariantProps<typeof cardSectionActionsVariants>) {
  // The row class comes after the spread, so no prop can replace it.
  return <div {...props} className={cardSectionActionsVariants({ share })} />;
}
