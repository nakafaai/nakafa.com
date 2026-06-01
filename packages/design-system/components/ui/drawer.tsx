"use client";

import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox";
import { Drawer as DrawerPrimitive } from "@base-ui/react/drawer";
import { mergeProps } from "@base-ui/react/merge-props";
import { Radio as RadioPrimitive } from "@base-ui/react/radio";
import { RadioGroup as RadioGroupPrimitive } from "@base-ui/react/radio-group";
import { useRender } from "@base-ui/react/use-render";
import {
  ArrowRight01Icon,
  Cancel01Icon,
  Tick01Icon,
} from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { ScrollArea } from "@repo/design-system/components/ui/scroll-area";
import { cn } from "@repo/design-system/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";
import { createContext, useContext } from "react";

type DrawerPosition = "bottom" | "left" | "right" | "top";

const DrawerContext = createContext<{ position: DrawerPosition }>({
  position: "bottom",
});

const swipeDirectionByPosition: Record<
  DrawerPosition,
  DrawerPrimitive.Root.Props["swipeDirection"]
> = {
  bottom: "down",
  left: "left",
  right: "right",
  top: "up",
};

const drawerViewportVariants = cva(
  "fixed inset-0 z-50 touch-none [--bleed:--spacing(12)] [--inset:--spacing(0)]",
  {
    compoundVariants: [
      {
        className: "pb-(--inset)",
        position: "bottom",
        variant: "inset",
      },
      {
        className: "pt-(--inset)",
        position: "top",
        variant: "inset",
      },
      {
        className: "py-(--inset)",
        position: "left",
        variant: "inset",
      },
      {
        className: "py-(--inset)",
        position: "right",
        variant: "inset",
      },
    ],
    defaultVariants: {
      position: "bottom",
      variant: "default",
    },
    variants: {
      position: {
        bottom: "grid grid-rows-[1fr_auto] pt-12",
        left: "flex justify-start",
        right: "flex justify-end",
        top: "grid grid-rows-[auto_1fr] pb-12",
      },
      variant: {
        default: "",
        inset: "px-(--inset) sm:[--inset:--spacing(4)]",
        straight: "",
      },
    },
  }
);

const drawerPopupVariants = cva(
  "relative flex max-h-full min-h-0 w-full min-w-0 touch-none flex-col bg-popover not-dark:bg-clip-padding text-popover-foreground shadow-lg/5 outline-none transition-[transform,box-shadow,height,background-color] duration-450 ease-[cubic-bezier(0.32,0.72,0,1)] will-change-transform [--peek:calc(--spacing(6)-1px)] [--scale-base:calc(max(0,1-(var(--nested-drawers)*var(--stack-step))))] [--scale:clamp(0,calc(var(--scale-base)+(var(--stack-step)*var(--stack-progress))),1)] [--shrink:calc(1-var(--scale))] [--stack-peek-offset:max(0px,calc((var(--nested-drawers)-var(--stack-progress))*var(--peek)))] [--stack-progress:clamp(0,var(--drawer-swipe-progress),1)] [--stack-step:0.05] before:pointer-events-none before:absolute before:inset-0 before:shadow-[0_1px_--theme(--color-black/4%)] after:pointer-events-none after:absolute after:bg-popover data-swiping:select-none data-nested-drawer-open:overflow-hidden data-nested-drawer-open:bg-[color-mix(in_srgb,var(--popover),var(--color-black)_calc(2%*(var(--nested-drawers)-var(--stack-progress))))] data-ending-style:shadow-transparent data-starting-style:shadow-transparent data-ending-style:duration-[calc(var(--drawer-swipe-strength)*400ms)] dark:data-nested-drawer-open:bg-[color-mix(in_srgb,var(--popover),var(--color-black)_calc(6%*(var(--nested-drawers)-var(--stack-progress))))] dark:before:shadow-[0_-1px_--theme(--color-white/6%)]",
  {
    compoundVariants: [
      {
        className:
          "rounded-t-2xl before:rounded-t-[calc(var(--radius-2xl)-1px)]",
        position: "bottom",
        variant: "default",
      },
      {
        className:
          "rounded-e-2xl before:rounded-e-[calc(var(--radius-2xl)-1px)] **:data-[slot=drawer-footer]:rounded-ee-[calc(var(--radius-2xl)-1px)]",
        position: "left",
        variant: "default",
      },
      {
        className:
          "rounded-s-2xl before:rounded-s-[calc(var(--radius-2xl)-1px)] **:data-[slot=drawer-footer]:rounded-es-[calc(var(--radius-2xl)-1px)]",
        position: "right",
        variant: "default",
      },
      {
        className:
          "rounded-b-2xl before:rounded-b-[calc(var(--radius-2xl)-1px)] **:data-[slot=drawer-footer]:rounded-b-[calc(var(--radius-2xl)-1px)]",
        position: "top",
        variant: "default",
      },
      {
        className: "rounded-t-2xl",
        position: "bottom",
        variant: "inset",
      },
      {
        className:
          "rounded-e-2xl **:data-[slot=drawer-footer]:rounded-ee-[calc(var(--radius-2xl)-1px)]",
        position: "left",
        variant: "inset",
      },
      {
        className:
          "rounded-s-2xl **:data-[slot=drawer-footer]:rounded-es-[calc(var(--radius-2xl)-1px)]",
        position: "right",
        variant: "inset",
      },
      {
        className:
          "rounded-b-2xl **:data-[slot=drawer-footer]:rounded-b-[calc(var(--radius-2xl)-1px)]",
        position: "top",
        variant: "inset",
      },
      {
        className:
          "before:hidden sm:rounded-2xl sm:border sm:after:bg-transparent sm:before:rounded-[calc(var(--radius-2xl)-1px)] sm:**:data-[slot=drawer-footer]:rounded-b-[calc(var(--radius-2xl)-1px)]",
        variant: "inset",
      },
    ],
    defaultVariants: {
      position: "bottom",
      variant: "default",
    },
    variants: {
      position: {
        bottom:
          "transform-[translateY(calc(var(--drawer-snap-point-offset)+var(--drawer-swipe-movement-y)))] data-nested-drawer-open:transform-[translateY(calc(var(--drawer-swipe-movement-y)-var(--stack-peek-offset)-(var(--shrink)*var(--height))))_scale(var(--scale))] data-ending-style:transform-[translateY(calc(100%+env(safe-area-inset-bottom,0px)+var(--inset)))] data-starting-style:transform-[translateY(calc(100%+env(safe-area-inset-bottom,0px)+var(--inset)))] row-start-2 -mb-[max(0px,calc(var(--drawer-snap-point-offset,0px)+clamp(0,1,var(--drawer-snap-point-offset,0px)/1px)*var(--drawer-swipe-movement-y,0px)))] h-(--drawer-height,auto) origin-[50%_calc(100%-var(--inset))] border-t pb-[max(0px,calc(env(safe-area-inset-bottom,0px)+var(--drawer-snap-point-offset,0px)+clamp(0,1,var(--drawer-snap-point-offset,0px)/1px)*var(--drawer-swipe-movement-y,0px)))] not-data-starting-style:not-data-ending-style:transition-[transform,box-shadow,height,background-color,margin,padding] [--height:max(0px,calc(var(--drawer-frontmost-height,var(--drawer-height))))] after:inset-x-0 after:top-full after:h-(--bleed) has-data-[slot=drawer-bar]:pt-2 data-ending-style:mb-0 data-starting-style:mb-0 data-nested-drawer-open:h-(--height) data-ending-style:pb-0 data-starting-style:pb-0",
        left: "transform-[translateX(var(--drawer-swipe-movement-x))] data-nested-drawer-open:transform-[translateX(calc(var(--drawer-swipe-movement-x)+var(--stack-peek-offset)))_scale(var(--scale))] data-ending-style:transform-[translateX(calc(-100%-var(--inset)))] data-starting-style:transform-[translateX(calc(-100%-var(--inset)))] h-full w-[calc(100%-(--spacing(12)))] max-w-md origin-right border-e after:inset-e-full after:inset-y-0 after:w-(--bleed) has-data-[slot=drawer-bar]:pe-2",
        right:
          "transform-[translateX(var(--drawer-swipe-movement-x))] data-nested-drawer-open:transform-[translateX(calc(var(--drawer-swipe-movement-x)-var(--stack-peek-offset)))_scale(var(--scale))] data-ending-style:transform-[translateX(calc(100%+var(--inset)))] data-starting-style:transform-[translateX(calc(100%+var(--inset)))] col-start-2 h-full w-[calc(100%-(--spacing(12)))] max-w-md origin-left border-s after:inset-s-full after:inset-y-0 after:w-(--bleed) has-data-[slot=drawer-bar]:ps-2",
        top: "transform-[translateY(var(--drawer-swipe-movement-y))] data-nested-drawer-open:transform-[translateY(calc(var(--drawer-swipe-movement-y)+var(--stack-peek-offset)+(var(--shrink)*var(--height))))_scale(var(--scale))] data-ending-style:transform-[translateY(calc(-100%-var(--inset)))] data-starting-style:transform-[translateY(calc(-100%-var(--inset)))] row-start-1 h-(--drawer-height,auto) origin-[50%_var(--inset)] border-b [--height:max(0px,calc(var(--drawer-frontmost-height,var(--drawer-height))))] after:inset-x-0 after:bottom-full after:h-(--bleed) has-data-[slot=drawer-bar]:pb-2 data-nested-drawer-open:h-(--height)",
      },
      variant: {
        default: "",
        inset: "",
        straight: "[--stack-step:0]",
      },
    },
  }
);

const drawerBarVariants = cva(
  "absolute flex touch-none items-center justify-center p-3 before:rounded-full before:bg-input",
  {
    defaultVariants: {
      position: "bottom",
    },
    variants: {
      position: {
        bottom: "inset-x-0 top-0 before:h-1 before:w-12",
        left: "inset-y-0 right-0 before:h-12 before:w-1",
        right: "inset-y-0 left-0 before:h-12 before:w-1",
        top: "inset-x-0 bottom-0 before:h-1 before:w-12",
      },
    },
  }
);

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

const DrawerCreateHandle = DrawerPrimitive.createHandle;

function Drawer({
  position = "bottom",
  swipeDirection,
  ...props
}: DrawerPrimitive.Root.Props & {
  position?: DrawerPosition;
}) {
  return (
    <DrawerContext.Provider value={{ position }}>
      <DrawerPrimitive.Root
        data-slot="drawer"
        swipeDirection={swipeDirection ?? swipeDirectionByPosition[position]}
        {...props}
      />
    </DrawerContext.Provider>
  );
}

function DrawerPortal(props: DrawerPrimitive.Portal.Props) {
  return <DrawerPrimitive.Portal data-slot="drawer-portal" {...props} />;
}

function DrawerTrigger(props: DrawerPrimitive.Trigger.Props) {
  return <DrawerPrimitive.Trigger data-slot="drawer-trigger" {...props} />;
}

function DrawerClose(props: DrawerPrimitive.Close.Props) {
  return <DrawerPrimitive.Close data-slot="drawer-close" {...props} />;
}

function DrawerSwipeArea({
  className,
  position: positionProp,
  ...props
}: DrawerPrimitive.SwipeArea.Props & {
  position?: DrawerPosition;
}) {
  const { position: contextPosition } = useContext(DrawerContext);
  const position = positionProp ?? contextPosition;

  return (
    <DrawerPrimitive.SwipeArea
      className={cn(
        "fixed z-50 touch-none",
        position === "bottom" && "inset-x-0 bottom-0 h-8",
        position === "top" && "inset-x-0 top-0 h-8",
        position === "left" && "inset-y-0 left-0 w-8",
        position === "right" && "inset-y-0 right-0 w-8",
        className
      )}
      data-slot="drawer-swipe-area"
      {...props}
    />
  );
}

function DrawerBackdrop({
  className,
  ...props
}: DrawerPrimitive.Backdrop.Props) {
  return (
    <DrawerPrimitive.Backdrop
      className={cn(
        "fixed inset-0 z-50 bg-black/32 opacity-[calc(1-var(--drawer-swipe-progress))] backdrop-blur-sm transition-opacity duration-450 ease-[cubic-bezier(0.32,0.72,0,1)] data-ending-style:opacity-0 data-starting-style:opacity-0 data-ending-style:duration-[calc(var(--drawer-swipe-strength)*400ms)] data-swiping:duration-0 supports-[-webkit-touch-callout:none]:absolute",
        className
      )}
      data-slot="drawer-backdrop"
      {...props}
    />
  );
}

function DrawerViewport({
  className,
  position: positionProp,
  variant,
  ...props
}: DrawerPrimitive.Viewport.Props &
  VariantProps<typeof drawerViewportVariants> & {
    position?: DrawerPosition;
  }) {
  const { position: contextPosition } = useContext(DrawerContext);
  const position = positionProp ?? contextPosition;

  return (
    <DrawerPrimitive.Viewport
      className={cn(drawerViewportVariants({ position, variant }), className)}
      data-slot="drawer-viewport"
      {...props}
    />
  );
}

function DrawerPopup({
  children,
  className,
  portalProps,
  position: positionProp,
  showBar = false,
  showCloseButton = false,
  variant,
  ...props
}: DrawerPrimitive.Popup.Props &
  VariantProps<typeof drawerPopupVariants> & {
    portalProps?: DrawerPrimitive.Portal.Props;
    position?: DrawerPosition;
    showBar?: boolean;
    showCloseButton?: boolean;
  }) {
  const { position: contextPosition } = useContext(DrawerContext);
  const position = positionProp ?? contextPosition;

  return (
    <DrawerPortal {...portalProps}>
      <DrawerBackdrop />
      <DrawerViewport position={position} variant={variant}>
        <DrawerPrimitive.Popup
          className={cn(drawerPopupVariants({ position, variant }), className)}
          data-slot="drawer-popup"
          {...props}
        >
          {children}
          {!!showCloseButton && (
            <DrawerClose
              aria-label="Close"
              className="absolute inset-e-2 top-2"
              render={<Button size="icon" variant="ghost" />}
            >
              <HugeIcons icon={Cancel01Icon} />
            </DrawerClose>
          )}
          {!!showBar && <DrawerBar position={position} />}
        </DrawerPrimitive.Popup>
      </DrawerViewport>
    </DrawerPortal>
  );
}

function DrawerContent({ className, ...props }: DrawerPrimitive.Content.Props) {
  return (
    <DrawerPrimitive.Content
      className={className}
      data-slot="drawer-content"
      {...props}
    />
  );
}

function DrawerPanel({
  allowSelection = true,
  className,
  render,
  scrollable = true,
  scrollFade = true,
  ...props
}: useRender.ComponentProps<"div"> & {
  allowSelection?: boolean;
  scrollable?: boolean;
  scrollFade?: boolean;
}) {
  const defaultProps = {
    className: cn("p-6", !allowSelection && "cursor-default", className),
    "data-slot": "drawer-panel",
  };

  const content = useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(defaultProps, props),
    render: allowSelection ? <DrawerContent render={render} /> : render,
  });

  if (!scrollable) {
    return content;
  }

  return (
    <ScrollArea className="touch-auto" scrollFade={scrollFade}>
      {content}
    </ScrollArea>
  );
}

function DrawerBar({
  className,
  position: positionProp,
  ...props
}: React.ComponentProps<"div"> & {
  position?: DrawerPosition;
}) {
  const { position: contextPosition } = useContext(DrawerContext);
  const position = positionProp ?? contextPosition;

  return (
    <div
      aria-hidden="true"
      className={cn(drawerBarVariants({ position }), className)}
      data-slot="drawer-bar"
      {...props}
    />
  );
}

function DrawerHeader({
  allowSelection = false,
  className,
  render,
  ...props
}: useRender.ComponentProps<"div"> & {
  allowSelection?: boolean;
}) {
  const defaultProps = {
    className: cn(
      "flex flex-col gap-2 p-6",
      !allowSelection && "cursor-default",
      className
    ),
    "data-slot": "drawer-header",
  };

  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(defaultProps, props),
    render: allowSelection ? <DrawerContent render={render} /> : render,
  });
}

function DrawerFooter({
  allowSelection = true,
  className,
  render,
  variant = "default",
  ...props
}: useRender.ComponentProps<"div"> & {
  allowSelection?: boolean;
  variant?: "bare" | "default";
}) {
  const defaultProps = {
    className: cn(
      "flex flex-col-reverse gap-2 px-6 pb-(--safe-area-inset-bottom,0px) md:flex-row md:justify-end max-md:[&>[data-slot=button]]:w-full",
      !allowSelection && "cursor-default",
      variant === "default" &&
        "border-t bg-muted/72 pt-4 pb-[calc(env(safe-area-inset-bottom,0px)+--spacing(4))]",
      variant === "bare" &&
        "pt-6 pb-[calc(env(safe-area-inset-bottom,0px)+--spacing(6))]",
      className
    ),
    "data-slot": "drawer-footer",
  };

  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(defaultProps, props),
    render: allowSelection ? <DrawerContent render={render} /> : render,
  });
}

function DrawerTitle({ className, ...props }: DrawerPrimitive.Title.Props) {
  return (
    <DrawerPrimitive.Title
      className={cn(
        "font-semibold text-foreground text-xl leading-none",
        className
      )}
      data-slot="drawer-title"
      {...props}
    />
  );
}

function DrawerDescription({
  className,
  ...props
}: DrawerPrimitive.Description.Props) {
  return (
    <DrawerPrimitive.Description
      className={cn("text-muted-foreground text-sm", className)}
      data-slot="drawer-description"
      {...props}
    />
  );
}

function DrawerMenu({
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

function DrawerMenuItem({
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

function DrawerMenuSeparator({
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

function DrawerMenuGroup({
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

function DrawerMenuGroupLabel({
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

function DrawerMenuTrigger({
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

function DrawerMenuCheckboxItem({
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

function DrawerMenuRadioGroup({
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

function DrawerMenuRadioItem({
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

export {
  Drawer,
  DrawerBackdrop,
  DrawerBackdrop as DrawerOverlay,
  DrawerBar,
  DrawerClose,
  DrawerContent,
  DrawerCreateHandle,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerMenu,
  DrawerMenuCheckboxItem,
  DrawerMenuGroup,
  DrawerMenuGroupLabel,
  DrawerMenuItem,
  DrawerMenuRadioGroup,
  DrawerMenuRadioItem,
  DrawerMenuSeparator,
  DrawerMenuTrigger,
  DrawerPanel,
  DrawerPopup,
  DrawerPortal,
  DrawerSwipeArea,
  DrawerTitle,
  DrawerTrigger,
  DrawerViewport,
};
