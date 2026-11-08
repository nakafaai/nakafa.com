import type { buttonVariants } from "@repo/design-system/lib/button";
import type { VariantProps } from "class-variance-authority";
import { createContext } from "react";

/**
 * The one variant every button of a `ButtonGroup` wears, read by `Button`. The group owns it, so a group holds a single
 * variant whatever its parts name, a part drawn by another component included, and no part switches variant with its
 * state. The quiet variants alone may join a group: the page's primary fill stands by itself, never inside one.
 *
 * Context reaches through a portal, so every popup of the design system starts outside any group: a dialog that opens
 * from a grouped button keeps its own primary.
 */
export const ButtonGroupVariant = createContext<
  | Extract<
      VariantProps<typeof buttonVariants>["variant"],
      "inverse-outline" | "outline" | "secondary"
    >
  | undefined
>(undefined);
