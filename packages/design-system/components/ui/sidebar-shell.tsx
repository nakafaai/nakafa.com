"use client";

import { PanelLeftIcon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@repo/design-system/components/ui/sheet";
import { useSidebar } from "@repo/design-system/lib/sidebar/context";
import { cn } from "cn";
import type { ComponentProps } from "react";

/** Renders the responsive sidebar panel around composed sidebar content. */
export function Sidebar({
  side = "left",
  variant = "sidebar",
  collapsible = "offcanvas",
  className,
  containerClassName,
  children,
  label,
  ...props
}: ComponentProps<"div"> & {
  side?: "left" | "right";
  variant?: "sidebar" | "floating" | "inset";
  collapsible?: "offcanvas" | "icon" | "none";
  containerClassName?: string;
  /** The name of the sidebar on small screens, in the reader's language. */
  label: string;
}) {
  const state = useSidebar((sidebar) => sidebar.state);
  const openMobile = useSidebar((sidebar) => sidebar.openMobile);
  const setOpenMobile = useSidebar((sidebar) => sidebar.setOpenMobile);
  // A collapsed off-canvas panel is slid out of view, so its links must leave the tab order.
  const isOffcanvasCollapsed =
    state === "collapsed" && collapsible === "offcanvas";

  if (collapsible === "none") {
    return (
      <div
        className={cn(
          "bg-sidebar text-sidebar-foreground flex h-full w-64 flex-col",
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
          className="bg-sidebar text-sidebar-foreground w-72 p-0 [&>button]:hidden"
          data-mobile="true"
          data-sidebar="sidebar"
          data-slot="sidebar"
          onClick={(event) => {
            // A link pressed in the phone sidebar opens its page in this tab, so the sheet steps
            // aside for it; a press that opens another tab leaves the sheet where it is.
            if (
              event.target instanceof Element &&
              event.target.closest("a[href]") !== null &&
              !(event.metaKey || event.ctrlKey || event.shiftKey)
            ) {
              setOpenMobile(false);
            }
          }}
          side={side}
        >
          <SheetHeader className="sr-only">
            <SheetTitle>{label}</SheetTitle>
          </SheetHeader>
          <div className="flex h-full w-full flex-col">{children}</div>
        </SheetContent>
      </Sheet>

      <div
        className={cn(
          "group peer text-sidebar-foreground hidden lg:block",
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
            "duration-surface relative w-64 bg-transparent transition-[width] motion-reduce:transition-none",
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
            "duration-surface fixed inset-y-0 z-10 hidden h-svh w-64 transition-[left,right,width] motion-reduce:transition-none md:flex",
            side === "left"
              ? "left-0 group-data-[collapsible=offcanvas]:-left-64"
              : "right-0 group-data-[collapsible=offcanvas]:-right-64",
            variant === "floating" || variant === "inset"
              ? "p-2 group-data-[collapsible=icon]:w-[calc(3rem+(--spacing(4))+2px)]"
              : "border-sidebar-border group-data-[collapsible=icon]:w-12 group-data-[side=left]:border-r group-data-[side=right]:border-l",
            className
          )}
          data-slot="sidebar-container"
          inert={isOffcanvasCollapsed}
          {...props}
        >
          <div
            className="bg-sidebar group-data-[variant=floating]:border-sidebar-border flex h-full w-full flex-col group-data-[variant=floating]:rounded-lg group-data-[variant=floating]:border group-data-[variant=floating]:shadow-sm"
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
  label,
  ...props
}: ComponentProps<typeof Button> & {
  icon?: ComponentProps<typeof HugeIcons>["icon"];
  /** The name of the toggle, in the reader's language. */
  label: string;
}) {
  const isLocked = useSidebar((sidebar) => sidebar.isLocked);
  const isMobile = useSidebar((sidebar) => sidebar.isMobile);
  const open = useSidebar((sidebar) => sidebar.open);
  const openMobile = useSidebar((sidebar) => sidebar.openMobile);
  const toggleSidebar = useSidebar((sidebar) => sidebar.toggleSidebar);

  if (isLocked) {
    return null;
  }

  return (
    <Button
      aria-expanded={isMobile ? openMobile : open}
      aria-label={label}
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
    </Button>
  );
}

/** Renders the narrow sidebar toggle rail for pointer gestures. */
export function SidebarRail({
  className,
  label,
  ...props
}: ComponentProps<"button"> & {
  /** The name of the toggle, in the reader's language. */
  label: string;
}) {
  const isLocked = useSidebar((sidebar) => sidebar.isLocked);
  const toggleSidebar = useSidebar((sidebar) => sidebar.toggleSidebar);

  if (isLocked) {
    return null;
  }

  return (
    <button
      aria-label={label}
      className={cn(
        "duration-surface hover:after:bg-sidebar-border absolute inset-y-0 z-20 hidden w-4 -translate-x-1/2 transition-[translate,left,right,background-color] group-data-[side=left]:-right-4 group-data-[side=right]:left-0 after:absolute after:inset-y-0 after:left-1/2 after:w-0.5 sm:flex",
        "in-data-[side=left]:cursor-w-resize in-data-[side=right]:cursor-e-resize",
        "[[data-side=left][data-sidebar-state=collapsed]_&]:cursor-e-resize [[data-side=right][data-sidebar-state=collapsed]_&]:cursor-w-resize",
        "hover:group-data-[collapsible=offcanvas]:bg-sidebar group-data-[collapsible=offcanvas]:translate-x-0 group-data-[collapsible=offcanvas]:after:left-full",
        "[[data-side=left][data-collapsible=offcanvas]_&]:-right-2",
        "[[data-side=right][data-collapsible=offcanvas]_&]:-left-2",
        className
      )}
      data-sidebar="rail"
      data-slot="sidebar-rail"
      onClick={toggleSidebar}
      tabIndex={-1}
      title={label}
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
        "bg-background relative flex w-full flex-1 flex-col",
        "md:peer-data-[variant=inset]:m-2 md:peer-data-[variant=inset]:ml-0 md:peer-data-[variant=inset]:rounded-lg md:peer-data-[variant=inset]:border md:peer-data-[variant=inset]:peer-data-[sidebar-state=collapsed]:ml-2",
        className
      )}
      data-slot="sidebar-inset"
      {...props}
    />
  );
}
