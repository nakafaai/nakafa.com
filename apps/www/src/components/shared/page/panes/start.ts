import type { ResizablePanel } from "@repo/design-system/components/ui/resizable";
import type { ComponentProps } from "react";
import { createContext } from "react";

/** A pane's size: a share of the group's width, such as `"35%"`, or a length, such as `"20rem"`. */
export type PaneSize = NonNullable<
  ComponentProps<typeof ResizablePanel>["defaultSize"]
>;

/** The size a pane starts at until a person sets one, as a share of the group's width or a length. */
export const PaneStartContext = createContext<PaneSize>("35%");
