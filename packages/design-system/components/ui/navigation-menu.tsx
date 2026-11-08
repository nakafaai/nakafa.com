import { NavigationMenu as NavigationMenuPrimitive } from "@base-ui/react/navigation-menu";
import { ArrowDown01Icon } from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { buttonVariants } from "@repo/design-system/lib/button";
import { PortalContainer } from "@repo/design-system/lib/portal";
import { cn } from "cn";
import { use } from "react";

// Source: https://ui.shadcn.com/docs/components/base/navigation-menu

/**
 * A row of sections whose links open in one shared popup. A section opens when
 * a pointer rests on its trigger or when the trigger is pressed, and the popup
 * stays open while the pointer moves from one trigger to the next, changing its
 * size and sliding its content toward the new section, so it never closes and
 * reopens between them. The keyboard moves through the triggers and into the
 * links, and Escape closes it.
 */
function NavigationMenu({
  align = "start",
  children,
  className,
  ...props
}: NavigationMenuPrimitive.Root.Props &
  Pick<NavigationMenuPrimitive.Positioner.Props, "align">) {
  return (
    <NavigationMenuPrimitive.Root
      className={cn("relative flex items-center", className)}
      data-slot="navigation-menu"
      {...props}
    >
      {children}
      <NavigationMenuPositioner align={align} />
    </NavigationMenuPrimitive.Root>
  );
}

function NavigationMenuList({
  className,
  ...props
}: NavigationMenuPrimitive.List.Props) {
  return (
    <NavigationMenuPrimitive.List
      className={cn("flex list-none items-center gap-0.5", className)}
      data-slot="navigation-menu-list"
      {...props}
    />
  );
}

function NavigationMenuItem({
  className,
  ...props
}: NavigationMenuPrimitive.Item.Props) {
  return (
    <NavigationMenuPrimitive.Item
      className={cn("relative", className)}
      data-slot="navigation-menu-item"
      {...props}
    />
  );
}

/** A section's trigger: a ghost button with a chevron that turns while its section is open. */
function NavigationMenuTrigger({
  children,
  className,
  ...props
}: NavigationMenuPrimitive.Trigger.Props) {
  return (
    <NavigationMenuPrimitive.Trigger
      className={cn(
        buttonVariants({ variant: "ghost" }),
        "group/navigation-menu-trigger data-popup-open:bg-muted gap-1",
        className
      )}
      data-slot="navigation-menu-trigger"
      {...props}
    >
      {children}
      <HugeIcons
        aria-hidden="true"
        className="duration-ui transition-transform group-data-popup-open/navigation-menu-trigger:rotate-180 motion-reduce:transition-none"
        icon={ArrowDown01Icon}
      />
    </NavigationMenuPrimitive.Trigger>
  );
}

/**
 * What one section shows in the shared popup. When the reader moves to another
 * section, the old content slides out on the side it came from and the new one
 * slides in from the other side.
 */
function NavigationMenuContent({
  className,
  ...props
}: NavigationMenuPrimitive.Content.Props) {
  return (
    <NavigationMenuPrimitive.Content
      className={cn(
        "duration-surface h-full w-auto p-2 transition-[opacity,translate] ease-out data-ending-style:opacity-0 data-ending-style:data-[activation-direction=left]:translate-x-1/2 data-ending-style:data-[activation-direction=right]:-translate-x-1/2 data-starting-style:opacity-0 data-starting-style:data-[activation-direction=left]:-translate-x-1/2 data-starting-style:data-[activation-direction=right]:translate-x-1/2 motion-reduce:transition-none",
        className
      )}
      data-slot="navigation-menu-content"
      {...props}
    />
  );
}

/** The shared popup under the triggers, which takes the size of the open section's content. */
function NavigationMenuPositioner({
  align = "start",
  alignOffset = 0,
  className,
  side = "bottom",
  sideOffset = 8,
  ...props
}: NavigationMenuPrimitive.Positioner.Props) {
  return (
    <NavigationMenuPrimitive.Portal container={use(PortalContainer)}>
      <NavigationMenuPrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        className={cn(
          "duration-surface isolate z-50 h-(--positioner-height) w-(--positioner-width) max-w-(--available-width) transition-[top,left,right,bottom] ease-out data-instant:transition-none motion-reduce:transition-none",
          className
        )}
        data-slot="navigation-menu-positioner"
        side={side}
        sideOffset={sideOffset}
        {...props}
      >
        <NavigationMenuPrimitive.Popup
          className="bg-popover text-popover-foreground duration-surface relative h-(--popup-height) w-(--popup-width) origin-(--transform-origin) rounded-xl border shadow-md transition-[opacity,scale,width,height] ease-out outline-none data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0 motion-reduce:transition-none"
          data-slot="navigation-menu-popup"
        >
          <NavigationMenuPrimitive.Viewport className="relative size-full overflow-hidden" />
        </NavigationMenuPrimitive.Popup>
      </NavigationMenuPrimitive.Positioner>
    </NavigationMenuPrimitive.Portal>
  );
}

/** One link of a section: its icon and its name, on the row a menu item draws. */
function NavigationMenuLink({
  className,
  ...props
}: NavigationMenuPrimitive.Link.Props) {
  return (
    <NavigationMenuPrimitive.Link
      className={cn(
        "hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground hover:**:text-accent-foreground focus-visible:**:text-accent-foreground data-active:bg-muted [&_svg:not([class*='text-'])]:text-muted-foreground flex min-h-9 items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden transition-colors [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      data-slot="navigation-menu-link"
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
