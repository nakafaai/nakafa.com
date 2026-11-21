import { ArrowDown01Icon } from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { buttonVariants } from "@repo/design-system/lib/button";
import {
  NavigationMenuContent as NavigationMenuContentPrimitive,
  NavigationMenuItem as NavigationMenuItemPrimitive,
  NavigationMenuLink as NavigationMenuLinkPrimitive,
  NavigationMenuList as NavigationMenuListPrimitive,
  NavigationMenu as NavigationMenuPrimitive,
  NavigationMenuTrigger as NavigationMenuTriggerPrimitive,
  NavigationMenuViewport,
} from "@ui-sdk/react/navigation-menu";
import { cn } from "cn";
import type * as React from "react";

/**
 * A row of sections whose links open in one shared popup. A section opens when a pointer rests on its trigger or
 * when the trigger is pressed, and the popup stays open while the pointer moves from one trigger to the next,
 * changing its size and sliding its content toward the new section, so it never closes and reopens between them.
 * The keyboard moves through the triggers and into the links, Escape closes it, and a link pressed closes it too.
 */
function NavigationMenu({
  align = "start",
  children,
  className,
  closeOnSelect = true,
  ...props
}: Omit<React.ComponentProps<typeof NavigationMenuPrimitive>, "children"> &
  Pick<React.ComponentProps<typeof NavigationMenuViewport>, "align"> & {
    children?: React.ReactNode;
  }) {
  return (
    <NavigationMenuPrimitive
      className={cn("relative flex items-center", className)}
      closeOnSelect={closeOnSelect}
      {...props}
    >
      {children}
      {/* The shared popup takes the open section's size and slides to its trigger. Its sections stand at its
          corner, so a wider one grows it toward the reading end. */}
      <NavigationMenuViewport
        align={align}
        className="bg-popover text-popover-foreground duration-surface relative z-50 h-(--viewport-height) w-(--viewport-width) origin-(--transform-origin) overflow-hidden rounded-xl border shadow-md transition-[opacity,scale,width,height,left,top] ease-out outline-none [--panel-height:var(--available-height)] data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0 motion-reduce:transition-none"
        sideOffset={8}
      />
    </NavigationMenuPrimitive>
  );
}

function NavigationMenuList({
  className,
  ...props
}: React.ComponentProps<typeof NavigationMenuListPrimitive>) {
  return (
    <NavigationMenuListPrimitive
      className={cn("flex list-none items-center gap-0.5", className)}
      {...props}
    />
  );
}

function NavigationMenuItem({
  className,
  ...props
}: React.ComponentProps<typeof NavigationMenuItemPrimitive>) {
  return (
    <NavigationMenuItemPrimitive
      className={cn("relative", className)}
      {...props}
    />
  );
}

/** A section's trigger: a ghost button with a chevron that turns while its section is open. */
function NavigationMenuTrigger({
  children,
  className,
  ...props
}: Omit<
  React.ComponentProps<typeof NavigationMenuTriggerPrimitive>,
  "children"
> & { children?: React.ReactNode }) {
  return (
    <NavigationMenuTriggerPrimitive
      className={cn(
        buttonVariants({ variant: "ghost" }),
        "group/navigation-menu-trigger data-open:bg-muted gap-1",
        className
      )}
      {...props}
    >
      {children}
      <HugeIcons
        aria-hidden="true"
        className="duration-ui transition-transform group-data-open/navigation-menu-trigger:rotate-180 motion-reduce:transition-none"
        icon={ArrowDown01Icon}
      />
    </NavigationMenuTriggerPrimitive>
  );
}

/**
 * What one section shows in the shared popup, from its corner, scrolling when it is taller than the screen leaves.
 * When the reader moves to another section, the old content slides out on the side it came from and the new one
 * slides in from the other side, mirrored in right-to-left text.
 */
function NavigationMenuContent({
  className,
  ...props
}: React.ComponentProps<typeof NavigationMenuContentPrimitive>) {
  return (
    <NavigationMenuContentPrimitive
      className={cn(
        "duration-surface absolute start-0 top-0 max-h-(--panel-height) w-max overflow-y-auto p-2 transition-[opacity,translate] ease-out data-ending-style:opacity-0 data-starting-style:opacity-0 data-[motion=from-end]:data-starting-style:translate-x-12 data-[motion=from-start]:data-starting-style:-translate-x-12 data-[motion=to-end]:data-ending-style:translate-x-12 data-[motion=to-start]:data-ending-style:-translate-x-12 motion-reduce:transition-none rtl:data-[motion=from-end]:data-starting-style:-translate-x-12 rtl:data-[motion=from-start]:data-starting-style:translate-x-12 rtl:data-[motion=to-end]:data-ending-style:-translate-x-12 rtl:data-[motion=to-start]:data-ending-style:translate-x-12",
        className
      )}
      {...props}
    />
  );
}

/**
 * One link of a section: its icon and its name, on the row a menu item draws. A link to the page the reader is on
 * passes `current`, which marks it for screen readers and shades it.
 */
function NavigationMenuLink({
  className,
  ...props
}: React.ComponentProps<typeof NavigationMenuLinkPrimitive>) {
  return (
    <NavigationMenuLinkPrimitive
      className={cn(
        "hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground hover:**:text-accent-foreground focus-visible:**:text-accent-foreground data-current:bg-muted [&_svg:not([class*='text-'])]:text-muted-foreground flex min-h-9 items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden transition-colors [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    />
  );
}

export {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
};
