"use client";

import { useRender } from "@base-ui/react/use-render";
import { Skeleton } from "@repo/design-system/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/design-system/components/ui/tooltip";
import { useSidebar } from "@repo/design-system/lib/sidebar/context";
import { cn } from "@repo/design-system/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps, ReactElement } from "react";

/** Renders the list container for sidebar menu items. */
export function SidebarMenu({ className, ...props }: ComponentProps<"ul">) {
  return (
    <ul
      className={cn("flex w-full min-w-0 flex-col gap-1", className)}
      data-sidebar="menu"
      data-slot="sidebar-menu"
      {...props}
    />
  );
}

/** Positions one sidebar menu button with its optional action and badge. */
export function SidebarMenuItem({ className, ...props }: ComponentProps<"li">) {
  return (
    <li
      className={cn("group/menu-item relative", className)}
      data-sidebar="menu-item"
      data-slot="sidebar-menu-item"
      {...props}
    />
  );
}

/**
 * Renders secondary menu text while inheriting the button's base, hover, and
 * active foreground instead of binding it to an unrelated page surface.
 */
export function SidebarMenuDescription(
  props: Omit<ComponentProps<"span">, "className" | "color" | "style">
) {
  return (
    <span
      className="truncate text-xs"
      data-sidebar="menu-description"
      data-slot="sidebar-menu-description"
      {...props}
    />
  );
}

const sidebarMenuButtonVariants = cva(
  "peer/menu-button flex w-full cursor-pointer items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm outline-hidden ring-sidebar-ring transition-all ease-out hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 group-has-data-[sidebar=menu-action]/menu-item:pr-8 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground data-popup-open:hover:bg-sidebar-accent data-popup-open:hover:text-sidebar-accent-foreground group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:p-2! [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        outline:
          "border border-sidebar-border bg-background hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
      },
      size: {
        default: "h-8 text-sm",
        sm: "h-7 text-xs",
        lg: "h-12 text-sm group-data-[collapsible=icon]:p-0!",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

const sidebarMenuSkeletonTextWidths = ["50", "60", "70", "80", "90"] as const;

const sidebarMenuSkeletonTextVariants = cva("h-4 flex-1", {
  variants: {
    width: {
      "50": "max-w-[50%]",
      "60": "max-w-[60%]",
      "70": "max-w-[70%]",
      "80": "max-w-[80%]",
      "90": "max-w-[90%]",
    },
  },
});

/**
 * Renders a sidebar menu control with active, size, variant, and collapsed-tooltip behavior.
 */
export function SidebarMenuButton({
  isActive = false,
  variant = "default",
  size = "default",
  tooltip,
  className,
  render,
  ...props
}: useRender.ComponentProps<"button"> & {
  isActive?: boolean;
  tooltip?: string | ComponentProps<typeof TooltipContent>;
} & VariantProps<typeof sidebarMenuButtonVariants>) {
  const { isMobile, state } = useSidebar();
  const button = useRender({
    defaultTagName: "button",
    render,
    props: {
      className: cn(sidebarMenuButtonVariants({ variant, size }), className),
      "data-active": isActive,
      "data-sidebar": "menu-button",
      "data-size": size,
      "data-slot": "sidebar-menu-button",
      ...props,
    },
  });

  if (!button) {
    return null;
  }

  if (!tooltip) {
    return button;
  }

  const tooltipProps =
    typeof tooltip === "string" ? { children: tooltip } : tooltip;

  return (
    <Tooltip>
      <TooltipTrigger render={button} />
      <TooltipContent
        align="center"
        hidden={state !== "collapsed" || isMobile}
        side="right"
        {...tooltipProps}
      />
    </Tooltip>
  );
}

/** Renders an optional action aligned to the trailing edge of a menu item. */
export function SidebarMenuAction({
  className,
  showOnHover = false,
  render,
  ...props
}: useRender.ComponentProps<"button"> & {
  showOnHover?: boolean;
}): ReactElement {
  return useRender({
    defaultTagName: "button",
    render,
    props: {
      className: cn(
        "absolute top-1.5 right-1 flex aspect-square w-5 items-center justify-center rounded-md p-0 text-sidebar-foreground outline-hidden ring-sidebar-ring transition-transform hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 peer-hover/menu-button:text-sidebar-accent-foreground [&>svg]:size-4 [&>svg]:shrink-0",
        "after:absolute after:-inset-2 md:after:hidden",
        "peer-data-[size=sm]/menu-button:top-1",
        "peer-data-[size=default]/menu-button:top-1.5",
        "peer-data-[size=lg]/menu-button:top-2.5",
        "group-data-[collapsible=icon]:hidden",
        !!showOnHover &&
          "group-focus-within/menu-item:opacity-100 group-hover/menu-item:opacity-100 data-popup-open:opacity-100 peer-data-[active=true]/menu-button:text-sidebar-accent-foreground md:opacity-0",
        className
      ),
      "data-sidebar": "menu-action",
      "data-slot": "sidebar-menu-action",
      ...props,
    },
  });
}

/** Renders a compact count or status badge beside a sidebar menu button. */
export function SidebarMenuBadge({
  className,
  ...props
}: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute right-1 flex h-5 min-w-5 select-none items-center justify-center rounded-md px-1 text-sidebar-foreground text-xs tabular-nums",
        "peer-hover/menu-button:text-sidebar-accent-foreground peer-data-[active=true]/menu-button:text-sidebar-accent-foreground",
        "peer-data-[size=sm]/menu-button:top-1",
        "peer-data-[size=default]/menu-button:top-1.5",
        "peer-data-[size=lg]/menu-button:top-2.5",
        "group-data-[collapsible=icon]:hidden",
        className
      )}
      data-sidebar="menu-badge"
      data-slot="sidebar-menu-badge"
      {...props}
    />
  );
}

/** Renders a deterministic-width placeholder for a loading sidebar menu row. */
export function SidebarMenuSkeleton({
  className,
  showIcon = false,
  index = 0,
  ...props
}: ComponentProps<"div"> & {
  showIcon?: boolean;
  index?: number;
}) {
  const widthIndex = index % sidebarMenuSkeletonTextWidths.length;
  const width = sidebarMenuSkeletonTextWidths[widthIndex];

  return (
    <div
      className={cn("flex h-8 items-center gap-2 rounded-md px-2", className)}
      data-sidebar="menu-skeleton"
      data-slot="sidebar-menu-skeleton"
      {...props}
    >
      {!!showIcon && (
        <Skeleton
          className="size-4 rounded-md"
          data-sidebar="menu-skeleton-icon"
        />
      )}
      <Skeleton
        className={sidebarMenuSkeletonTextVariants({ width })}
        data-sidebar="menu-skeleton-text"
      />
    </div>
  );
}
