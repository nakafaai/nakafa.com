import type { NodeChildren } from "@repo/design-system/lib/render";
import { scrollFadeVariants } from "@repo/design-system/lib/scrollbar";
import { ScrollArea, ScrollAreaViewport } from "@ui-sdk/react/scroll-area";
import {
  TabsIndicator,
  TabsList as TabsListPrimitive,
  TabsPanel as TabsPanelPrimitive,
  Tabs as TabsPrimitive,
  TabsTab as TabsTabPrimitive,
} from "@ui-sdk/react/tabs";
import { cn } from "cn";
import type * as React from "react";

/**
 * The one tab bar of the product, a page's second header row, a pane's or a dialog's alike. The current tab reads in the
 * text color, the others stay muted, and one underline over the bar's line slides between them, in light and dark. A
 * tab has no side padding, so its text, its underline and the row's gutter stand on one edge. Route tabs pass a `Link`
 * through `render`. A narrow screen scrolls the bar within itself, never the page, and the edge that hides more tabs fades.
 */
export function Tabs({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive>): React.ReactElement {
  return (
    <TabsPrimitive
      className={cn("flex shrink-0 flex-col gap-2", className)}
      {...props}
    />
  );
}

export function TabsList({
  children,
  className,
  ...props
}: NodeChildren<
  React.ComponentProps<typeof TabsListPrimitive>
>): React.ReactElement {
  return (
    // The line under the bar stands outside its scroller, so the current tab's underline covers it.
    <ScrollArea className="w-full shrink-0 border-b">
      {/* The bar is the scroll viewport itself, so an edge with more tabs behind it fades and a reader sees the bar moves. */}
      <ScrollAreaViewport
        className={cn(
          // The underline is measured once the page's scripts run, so until then the current tab draws its own in the same place.
          "focus-visible:ring-ring relative -mb-px flex h-12 w-full gap-6 outline-none focus-visible:ring-2 focus-visible:ring-inset [&:not(:has(>[data-slot=tabs-indicator][style]))]:[--tab-active-line:var(--foreground)]",
          scrollFadeVariants({ start: true }),
          className
        )}
        render={<TabsListPrimitive {...props} />}
      >
        {children}
        <TabsIndicator className="bg-foreground absolute bottom-0 left-0 z-10 h-0.5 w-(--active-tab-width) translate-x-(--active-tab-left) transition-[width,translate] duration-200 ease-in-out data-[activation-direction=none]:transition-none motion-reduce:transition-none" />
      </ScrollAreaViewport>
    </ScrollArea>
  );
}

export function TabsTab({
  className,
  ...props
}: React.ComponentProps<typeof TabsTabPrimitive>): React.ReactElement {
  return (
    <TabsTabPrimitive
      className={cn(
        "text-muted-foreground hover:text-foreground focus-visible:ring-ring data-selected:text-foreground inline-flex shrink-0 items-center gap-1.5 border-b-2 border-transparent text-sm font-medium whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-inset data-disabled:pointer-events-none data-disabled:opacity-50 data-selected:border-[color:var(--tab-active-line,transparent)] [&_svg]:size-4",
        className
      )}
      {...props}
    />
  );
}

export function TabsPanel({
  className,
  ...props
}: React.ComponentProps<typeof TabsPanelPrimitive>): React.ReactElement {
  return (
    <TabsPanelPrimitive
      className={cn("flex-1 outline-none", className)}
      {...props}
    />
  );
}
