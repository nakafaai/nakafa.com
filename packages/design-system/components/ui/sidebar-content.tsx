"use client";

import { useRender } from "@base-ui/react/use-render";
import { Input } from "@repo/design-system/components/ui/input";
import { Separator } from "@repo/design-system/components/ui/separator";
import { cn } from "@repo/design-system/lib/utils";
import type { ComponentProps, ReactElement } from "react";

/** Renders a compact input aligned with the sidebar surface. */
export function SidebarInput({
  className,
  ...props
}: ComponentProps<typeof Input>) {
  return (
    <Input
      className={cn(
        "h-8 w-full border-sidebar-border bg-background shadow-none focus-visible:border-sidebar-ring focus-visible:ring-sidebar-ring",
        className
      )}
      data-sidebar="input"
      data-slot="sidebar-input"
      {...props}
    />
  );
}

/** Renders the sidebar's fixed top content region. */
export function SidebarHeader({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("flex flex-col gap-2 border-sidebar-border p-2", className)}
      data-sidebar="header"
      data-slot="sidebar-header"
      {...props}
    />
  );
}

/** Renders the sidebar's fixed bottom content region. */
export function SidebarFooter({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("flex flex-col gap-2 border-sidebar-border p-2", className)}
      data-sidebar="footer"
      data-slot="sidebar-footer"
      {...props}
    />
  );
}

/** Separates adjacent sidebar content regions with the sidebar border token. */
export function SidebarSeparator({
  className,
  ...props
}: ComponentProps<typeof Separator>) {
  return (
    <Separator
      className={cn("mx-2 w-auto bg-sidebar-border", className)}
      data-sidebar="separator"
      data-slot="sidebar-separator"
      {...props}
    />
  );
}

/** Renders the scrollable content region between sidebar header and footer. */
export function SidebarContent({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col gap-2 overflow-auto group-data-[collapsible=icon]:overflow-hidden",
        className
      )}
      data-sidebar="content"
      data-slot="sidebar-content"
      {...props}
    />
  );
}

/** Groups a labeled set of related sidebar navigation or controls. */
export function SidebarGroup({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("relative flex w-full min-w-0 flex-col p-2", className)}
      data-sidebar="group"
      data-slot="sidebar-group"
      {...props}
    />
  );
}

/** Labels a SidebarGroup while preserving readable text in every theme. */
export function SidebarGroupLabel({
  className,
  render,
  ...props
}: useRender.ComponentProps<"div">): ReactElement {
  return useRender({
    defaultTagName: "div",
    render,
    props: {
      className: cn(
        "flex h-8 shrink-0 items-center rounded-md px-2 font-medium text-sidebar-foreground text-xs outline-hidden ring-sidebar-ring transition-[margin,opacity] duration-200 ease-out focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0",
        "group-data-[collapsible=icon]:-mt-8 group-data-[collapsible=icon]:opacity-0",
        className
      ),
      "data-sidebar": "group-label",
      "data-slot": "sidebar-group-label",
      ...props,
    },
  });
}

/** Renders an optional action aligned with a SidebarGroupLabel. */
export function SidebarGroupAction({
  className,
  render,
  ...props
}: useRender.ComponentProps<"button">): ReactElement {
  return useRender({
    defaultTagName: "button",
    render,
    props: {
      className: cn(
        "absolute top-3.5 right-3 flex aspect-square w-5 items-center justify-center rounded-md p-0 text-sidebar-foreground outline-hidden ring-sidebar-ring transition-transform hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0",
        "after:absolute after:-inset-2 md:after:hidden",
        "group-data-[collapsible=icon]:hidden",
        className
      ),
      "data-sidebar": "group-action",
      "data-slot": "sidebar-group-action",
      ...props,
    },
  });
}

/** Wraps the menu or controls owned by a SidebarGroup. */
export function SidebarGroupContent({
  className,
  ...props
}: ComponentProps<"div">) {
  return (
    <div
      className={cn("w-full text-sm", className)}
      data-sidebar="group-content"
      data-slot="sidebar-group-content"
      {...props}
    />
  );
}
