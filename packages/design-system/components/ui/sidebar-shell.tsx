"use client";

import { PanelLeftIcon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@repo/design-system/components/ui/sheet";
import { useSidebar } from "@repo/design-system/components/ui/sidebar-provider";
import { cn } from "@repo/design-system/lib/utils";
import type { ComponentProps } from "react";

/** Renders the responsive sidebar panel around composed sidebar content. */
export function Sidebar({
  side = "left",
  variant = "sidebar",
  collapsible = "offcanvas",
  className,
  containerClassName,
  children,
  ...props
}: ComponentProps<"div"> & {
  side?: "left" | "right";
  variant?: "sidebar" | "floating" | "inset";
  collapsible?: "offcanvas" | "icon" | "none";
  containerClassName?: string;
}) {
  const { state, openMobile, setOpenMobile } = useSidebar();

  if (collapsible === "none") {
    return (
      <div
        className={cn(
          "flex h-full w-64 flex-col bg-sidebar text-sidebar-foreground",
          className
        )}
        data-slot="sidebar"
        {...props}
      >
        {children}
      </div>
    );
  }

  return (
    <>
      <Sheet onOpenChange={setOpenMobile} open={openMobile}>
        <SheetContent
          className="w-72 bg-sidebar p-0 text-sidebar-foreground [&>button]:hidden"
          data-mobile="true"
          data-sidebar="sidebar"
          data-slot="sidebar"
          side={side}
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Sidebar</SheetTitle>
            <SheetDescription>Displays the mobile sidebar.</SheetDescription>
          </SheetHeader>
          <div className="flex h-full w-full flex-col">{children}</div>
        </SheetContent>
      </Sheet>

      <div
        className={cn(
          "group peer hidden text-sidebar-foreground lg:block",
          containerClassName
        )}
        data-collapsible={state === "collapsed" ? collapsible : ""}
        data-side={side}
        data-sidebar-state={state}
        data-slot="sidebar"
        data-variant={variant}
      >
        <div
          className={cn(
            "relative w-64 bg-transparent transition-[width] duration-200 ease-out",
            "group-data-[collapsible=offcanvas]:w-0",
            "group-data-[side=right]:rotate-180",
            variant === "floating" || variant === "inset"
              ? "group-data-[collapsible=icon]:w-[calc(3rem+(--spacing(4)))]"
              : "group-data-[collapsible=icon]:w-12"
          )}
          data-slot="sidebar-gap"
        />
        <div
          className={cn(
            "fixed inset-y-0 z-10 hidden h-svh w-64 transition-[left,right,width] duration-200 ease-out md:flex",
            side === "left"
              ? "left-0 group-data-[collapsible=offcanvas]:-left-64"
              : "right-0 group-data-[collapsible=offcanvas]:-right-64",
            variant === "floating" || variant === "inset"
              ? "p-2 group-data-[collapsible=icon]:w-[calc(3rem+(--spacing(4))+2px)]"
              : "group-data-[collapsible=icon]:w-12 group-data-[side=left]:border-r group-data-[side=right]:border-l",
            className
          )}
          data-slot="sidebar-container"
          {...props}
        >
          <div
            className="flex h-full w-full flex-col bg-sidebar group-data-[variant=floating]:rounded-lg group-data-[variant=floating]:border group-data-[variant=floating]:border-sidebar-border group-data-[variant=floating]:shadow-sm"
            data-sidebar="sidebar"
            data-slot="sidebar-inner"
          >
            {children}
          </div>
        </div>
      </div>
    </>
  );
}

/** Renders the button that toggles the nearest sidebar. */
export function SidebarTrigger({
  className,
  onClick,
  icon,
  ...props
}: ComponentProps<typeof Button> & {
  icon?: ComponentProps<typeof HugeIcons>["icon"];
}) {
  const { isLocked, toggleSidebar } = useSidebar();

  if (isLocked) {
    return null;
  }

  return (
    <Button
      aria-label="Toggle Sidebar"
      className={cn("size-7", className)}
      data-sidebar="trigger"
      data-slot="sidebar-trigger"
      onClick={(event) => {
        onClick?.(event);
        toggleSidebar();
      }}
      size="icon"
      variant="ghost"
      {...props}
    >
      <HugeIcons icon={icon ?? PanelLeftIcon} />
      <span className="sr-only">Toggle Sidebar</span>
    </Button>
  );
}

/** Renders the narrow sidebar toggle rail for pointer gestures. */
export function SidebarRail({ className, ...props }: ComponentProps<"button">) {
  const { isLocked, toggleSidebar } = useSidebar();

  if (isLocked) {
    return null;
  }

  return (
    <button
      aria-label="Toggle Sidebar"
      className={cn(
        "absolute inset-y-0 z-20 hidden w-4 -translate-x-1/2 transition-all ease-out after:absolute after:inset-y-0 after:left-1/2 after:w-0.5 hover:after:bg-sidebar-border group-data-[side=left]:-right-4 group-data-[side=right]:left-0 sm:flex",
        "in-data-[side=left]:cursor-w-resize in-data-[side=right]:cursor-e-resize",
        "[[data-side=left][data-sidebar-state=collapsed]_&]:cursor-e-resize [[data-side=right][data-sidebar-state=collapsed]_&]:cursor-w-resize",
        "group-data-[collapsible=offcanvas]:translate-x-0 hover:group-data-[collapsible=offcanvas]:bg-sidebar group-data-[collapsible=offcanvas]:after:left-full",
        "[[data-side=left][data-collapsible=offcanvas]_&]:-right-2",
        "[[data-side=right][data-collapsible=offcanvas]_&]:-left-2",
        className
      )}
      data-sidebar="rail"
      data-slot="sidebar-rail"
      onClick={toggleSidebar}
      tabIndex={-1}
      title="Toggle Sidebar"
      type="button"
      {...props}
    />
  );
}

/** Wraps the page content that sits beside an inset sidebar. */
export function SidebarInset({ className, ...props }: ComponentProps<"main">) {
  return (
    <main
      className={cn(
        "relative flex w-full flex-1 flex-col bg-background",
        "md:peer-data-[variant=inset]:peer-data-[sidebar-state=collapsed]:ml-2 md:peer-data-[variant=inset]:m-2 md:peer-data-[variant=inset]:ml-0 md:peer-data-[variant=inset]:rounded-lg md:peer-data-[variant=inset]:border",
        className
      )}
      data-slot="sidebar-inset"
      {...props}
    />
  );
}
