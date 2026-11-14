import { ScrollArea as ScrollAreaPrimitive } from "@base-ui/react/scroll-area";
import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
import { scrollFadeVariants } from "@repo/design-system/lib/scrollbar";
import { cn } from "cn";
import type React from "react";

/**
 * The one tab bar of the product, a page's second header row, a pane's or a dialog's alike. The current tab reads in the
 * text color, the others stay muted, and one underline over the bar's line slides between them, in light and dark. A
 * tab has no side padding, so its text, its underline and the row's gutter stand on one edge. Route tabs pass a `Link`
 * through `render`. A narrow screen scrolls the bar within itself, never the page, and the edge that hides more tabs fades.
 */
export function Tabs({
  className,
  ...props
}: TabsPrimitive.Root.Props): React.ReactElement {
  return (
    <TabsPrimitive.Root
      className={cn("flex shrink-0 flex-col gap-2", className)}
      data-slot="tabs"
      {...props}
    />
  );
}

export function TabsList({
  children,
  className,
  ...props
}: TabsPrimitive.List.Props): React.ReactElement {
  return (
    // The line under the bar stands outside its scroller, so the current tab's underline covers it.
    <ScrollAreaPrimitive.Root className="w-full shrink-0 border-b">
      {/* The bar is the scroll viewport itself, so an edge with more tabs behind it fades and a reader sees the bar moves. */}
      <ScrollAreaPrimitive.Viewport
        className={cn(
          // The underline waits for the page's scripts, so until it shows the current tab draws its own in the same place.
          "focus-visible:ring-ring relative -mb-px flex h-12 w-full gap-6 outline-none focus-visible:ring-2 focus-visible:ring-inset [&:not(:has(>[data-slot=tab-indicator]:not([hidden])))]:[--tab-active-line:var(--foreground)]",
          scrollFadeVariants({ start: true }),
          className
        )}
        data-slot="tabs-list"
        render={<TabsPrimitive.List {...props} />}
      >
        {children}
        <TabsPrimitive.Indicator
          className="bg-foreground absolute bottom-0 left-0 z-10 h-0.5 w-(--active-tab-width) translate-x-(--active-tab-left) transition-[width,translate] duration-200 ease-in-out motion-reduce:transition-none"
          data-slot="tab-indicator"
        />
      </ScrollAreaPrimitive.Viewport>
    </ScrollAreaPrimitive.Root>
  );
}

export function TabsTab({
  className,
  ...props
}: TabsPrimitive.Tab.Props): React.ReactElement {
  return (
    <TabsPrimitive.Tab
      className={cn(
        "text-muted-foreground hover:text-foreground focus-visible:ring-ring data-active:text-foreground inline-flex shrink-0 items-center gap-1.5 border-b-2 border-transparent text-sm font-medium whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-inset disabled:pointer-events-none disabled:opacity-50 data-active:border-[color:var(--tab-active-line,transparent)] [&_svg]:size-4",
        className
      )}
      data-slot="tabs-tab"
      {...props}
    />
  );
}

export function TabsPanel({
  className,
  ...props
}: TabsPrimitive.Panel.Props): React.ReactElement {
  return (
    <TabsPrimitive.Panel
      className={cn("flex-1 outline-none", className)}
      data-slot="tabs-content"
      {...props}
    />
  );
}

export { TabsPanel as TabsContent, TabsTab as TabsTrigger };
