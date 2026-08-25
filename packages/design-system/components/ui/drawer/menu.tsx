"use client";

import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox";
import type { Drawer as DrawerPrimitive } from "@base-ui/react/drawer";
import { mergeProps } from "@base-ui/react/merge-props";
import { Radio as RadioPrimitive } from "@base-ui/react/radio";
import { RadioGroup as RadioGroupPrimitive } from "@base-ui/react/radio-group";
import { useRender } from "@base-ui/react/use-render";
import { ArrowRight01Icon, Tick01Icon } from "@hugeicons/core-free-icons";
import { DrawerTrigger } from "@repo/design-system/components/ui/drawer";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { cn } from "@repo/design-system/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

const drawerMenuItemVariants = cva(
  "flex min-h-9 w-full cursor-default select-none items-center gap-2 rounded-sm px-2 py-1 text-base text-foreground outline-none transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-64 data-disabled:pointer-events-none data-disabled:opacity-64 sm:min-h-8 sm:text-sm [&>svg:not([class*='opacity-'])]:opacity-80 [&>svg:not([class*='size-'])]:size-4.5 sm:[&>svg:not([class*='size-'])]:size-4 [&>svg]:pointer-events-none [&>svg]:-mx-0.5 [&>svg]:shrink-0",
  {
    defaultVariants: {
      variant: "default",
    },
    variants: {
      variant: {
        default: "",
        destructive: "text-destructive",
      },
    },
  }
);

/** Renders a drawer-local navigation menu with slot metadata for styling. */
export function DrawerMenu({
  className,
  render,
  ...props
}: useRender.ComponentProps<"nav">) {
  const defaultProps = {
    className: cn("-m-2 flex flex-col", className),
    "data-slot": "drawer-menu",
  };

  return useRender({
    defaultTagName: "nav",
    props: mergeProps<"nav">(defaultProps, props),
    render,
  });
}

/** Renders one command-style menu item inside a drawer menu. */
export function DrawerMenuItem({
  className,
  disabled,
  render,
  variant,
  ...props
}: useRender.ComponentProps<"button"> &
  VariantProps<typeof drawerMenuItemVariants>) {
  const defaultProps = {
    className: cn(drawerMenuItemVariants({ variant }), className),
    "data-slot": "drawer-menu-item",
    disabled,
    type: "button" as const,
  };

  return useRender({
    defaultTagName: "button",
    props: mergeProps<"button">(defaultProps, props),
    render,
  });
}

/** Renders a visual separator between drawer menu groups or items. */
export function DrawerMenuSeparator({
  className,
  render,
  ...props
}: useRender.ComponentProps<"div">) {
  const defaultProps = {
    className: cn("mx-2 my-1 h-px bg-border", className),
    "data-slot": "drawer-menu-separator",
  };

  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(defaultProps, props),
    render,
  });
}

/** Groups related drawer menu items without changing their command semantics. */
export function DrawerMenuGroup({
  className,
  render,
  ...props
}: useRender.ComponentProps<"div">) {
  const defaultProps = {
    className: cn("flex flex-col", className),
    "data-slot": "drawer-menu-group",
  };

  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(defaultProps, props),
    render,
  });
}

/** Labels a drawer menu group with subdued non-interactive text. */
export function DrawerMenuGroupLabel({
  className,
  render,
  ...props
}: useRender.ComponentProps<"div">) {
  const defaultProps = {
    className: cn("px-2 py-1.5 text-muted-foreground text-xs", className),
    "data-slot": "drawer-menu-group-label",
  };

  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(defaultProps, props),
    render,
  });
}

/** Renders a drawer menu item that opens a nested drawer. */
export function DrawerMenuTrigger({
  children,
  className,
  ...props
}: DrawerPrimitive.Trigger.Props) {
  return (
    <DrawerTrigger
      className={cn(drawerMenuItemVariants(), className)}
      data-slot="drawer-menu-trigger"
      {...props}
    >
      {children}
      <HugeIcons className="ms-auto opacity-80" icon={ArrowRight01Icon} />
    </DrawerTrigger>
  );
}

/** Renders a checked drawer menu item using checkbox or switch affordance. */
export function DrawerMenuCheckboxItem({
  checked,
  children,
  className,
  defaultChecked,
  disabled,
  onCheckedChange,
  render,
  variant = "default",
  ...props
}: CheckboxPrimitive.Root.Props & {
  render?: React.ReactElement;
  variant?: "default" | "switch";
}) {
  return (
    <CheckboxPrimitive.Root
      checked={checked}
      className={cn(
        drawerMenuItemVariants(),
        variant === "switch"
          ? "grid grid-cols-[1fr_auto] gap-4 pe-2"
          : "grid grid-cols-[1rem_1fr] pe-4",
        className
      )}
      data-slot="drawer-menu-checkbox-item"
      defaultChecked={defaultChecked}
      disabled={disabled}
      onCheckedChange={onCheckedChange}
      render={render}
      {...props}
    >
      {variant === "switch" ? (
        <>
          <span>{children}</span>
          <CheckboxPrimitive.Indicator
            className="inline-flex h-5 w-9 shrink-0 items-center rounded-full bg-input p-px transition-colors data-checked:bg-primary"
            keepMounted
          >
            <span className="block size-4 in-[[data-slot=drawer-menu-checkbox-item][data-checked]]:translate-x-4 rounded-full bg-background shadow-sm transition-transform" />
          </CheckboxPrimitive.Indicator>
        </>
      ) : (
        <>
          <CheckboxPrimitive.Indicator className="col-start-1">
            <HugeIcons icon={Tick01Icon} />
          </CheckboxPrimitive.Indicator>
          <span className="col-start-2">{children}</span>
        </>
      )}
    </CheckboxPrimitive.Root>
  );
}

/** Groups mutually exclusive drawer menu radio items. */
export function DrawerMenuRadioGroup({
  className,
  ...props
}: RadioGroupPrimitive.Props) {
  return (
    <RadioGroupPrimitive
      className={cn("flex flex-col", className)}
      data-slot="drawer-menu-radio-group"
      {...props}
    />
  );
}

/** Renders one mutually exclusive drawer menu option. */
export function DrawerMenuRadioItem({
  children,
  className,
  disabled,
  render,
  value,
  ...props
}: RadioPrimitive.Root.Props & {
  render?: React.ReactElement;
}) {
  return (
    <RadioPrimitive.Root
      className={cn(
        drawerMenuItemVariants(),
        "grid grid-cols-[1rem_1fr] pe-4",
        className
      )}
      data-slot="drawer-menu-radio-item"
      disabled={disabled}
      render={render}
      value={value}
      {...props}
    >
      <RadioPrimitive.Indicator className="col-start-1">
        <HugeIcons icon={Tick01Icon} />
      </RadioPrimitive.Indicator>
      <span className="col-start-2">{children}</span>
    </RadioPrimitive.Root>
  );
}
