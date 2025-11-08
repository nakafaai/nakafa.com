"use client";

import { Tooltip as TooltipPrimitive } from "@base-ui-components/react/tooltip";
import { cn } from "@repo/design-system/lib/utils";
import { memo } from "react";

const TooltipProvider = memo(
  ({
    delay = 0,
    ...props
  }: React.ComponentProps<typeof TooltipPrimitive.Provider>) => (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delay={delay}
      {...props}
    />
  )
);
TooltipProvider.displayName = "TooltipProvider";

const Tooltip = memo((props: TooltipPrimitive.Root.Props) => (
  <TooltipPrimitive.Root data-slot="tooltip" {...props} />
));
Tooltip.displayName = "Tooltip";

const TooltipTrigger = memo((props: TooltipPrimitive.Trigger.Props) => (
  <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />
));

const TooltipPopup = memo(
  ({
    className,
    align = "center",
    sideOffset = 4,
    side = "top",
    children,
    ...props
  }: TooltipPrimitive.Popup.Props & {
    align?: TooltipPrimitive.Positioner.Props["align"];
    side?: TooltipPrimitive.Positioner.Props["side"];
    sideOffset?: TooltipPrimitive.Positioner.Props["sideOffset"];
  }) => (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Positioner
        align={align}
        className="z-50"
        data-slot="tooltip-positioner"
        side={side}
        sideOffset={sideOffset}
      >
        <TooltipPrimitive.Popup
          className={cn(
            "fade-in-0 zoom-in-95 data-closed:fade-out-0 data-closed:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 w-fit origin-(--transform-origin) animate-in text-balance rounded-md bg-primary px-3 py-1.5 text-primary-foreground text-xs data-closed:animate-out",
            className
          )}
          data-slot="tooltip-content"
          {...props}
        >
          {children}
        </TooltipPrimitive.Popup>
      </TooltipPrimitive.Positioner>
    </TooltipPrimitive.Portal>
  )
);
TooltipPopup.displayName = "TooltipPopup";

export {
  TooltipProvider,
  Tooltip,
  TooltipTrigger,
  TooltipPopup,
  TooltipPopup as TooltipContent,
};
