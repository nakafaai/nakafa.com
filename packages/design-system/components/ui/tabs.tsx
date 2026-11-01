import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
import { cn } from "cn";
import type React from "react";

/**
 * The one tab bar of the product, a page's second header row, a pane's or a dialog's alike. The current tab reads in the
 * text color with its underline over the bar's line, in light and dark, and the others stay muted. Route tabs pass a
 * `Link` through `render`. A narrow screen scrolls the bar within itself, never the page.
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
  className,
  ...props
}: TabsPrimitive.List.Props): React.ReactElement {
  return (
    // The line under the bar stands outside its scroller, so the current tab's underline covers it.
    <div className="w-full shrink-0 border-b">
      <TabsPrimitive.List
        className={cn(
          "-mb-px flex h-12 w-full gap-1 overflow-x-auto",
          className
        )}
        data-slot="tabs-list"
        {...props}
      />
    </div>
  );
}

export function TabsTab({
  className,
  ...props
}: TabsPrimitive.Tab.Props): React.ReactElement {
  return (
    <TabsPrimitive.Tab
      className={cn(
        "text-muted-foreground hover:text-foreground focus-visible:ring-ring data-active:border-foreground data-active:text-foreground inline-flex shrink-0 items-center gap-1.5 border-b-2 border-transparent px-3 text-sm font-medium whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-inset disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4",
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
