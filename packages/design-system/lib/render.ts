import type { RenderProp } from "@ui-sdk/react/primitive";
import type * as React from "react";

/** The props of a design-system element that a caller may draw as another element, such as a router `Link`. */
export type RenderableProps<Tag extends keyof React.JSX.IntrinsicElements> =
  React.ComponentProps<Tag> & Partial<Record<"render", RenderProp | undefined>>;

/**
 * The props of a UI SDK part that a design-system part draws beside parts of its own, such as a menu's label above its
 * items. Its children are nodes, never a function of the part's state, as the part's own siblings stand beside them.
 */
export type NodeChildren<Props> = Omit<Props, "children"> &
  Partial<Record<"children", React.ReactNode>>;
