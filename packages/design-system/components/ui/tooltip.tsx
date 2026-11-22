"use client";

import { PopupPlace } from "@repo/design-system/components/ui/popup-place";
import { PopupContainer, popupMotion } from "@repo/design-system/lib/popup";
import {
  TooltipContent as TooltipContentPrimitive,
  Tooltip as TooltipPrimitive,
  TooltipTrigger as TooltipTriggerPrimitive,
} from "@ui-sdk/react/tooltip";
import { cn } from "cn";
import type * as React from "react";
import { use } from "react";

/**
 * The words of a control that shows only an icon, on hover and focus. It names the action; it never holds anything a
 * reader must read. It opens the moment the pointer rests, and the next one along a row opens at once. It never takes
 * the pointer, so a press on the control it covers, such as the next row's in a table, reaches that control.
 */
function Tooltip({
  delay = 0,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive>) {
  return (
    <TooltipPrimitive
      container={use(PopupContainer)}
      delay={delay}
      {...props}
    />
  );
}

function TooltipTrigger(
  props: React.ComponentProps<typeof TooltipTriggerPrimitive>
) {
  return <TooltipTriggerPrimitive {...props} />;
}

function TooltipContent({
  className,
  ...props
}: React.ComponentProps<typeof TooltipContentPrimitive>) {
  return (
    <PopupPlace>
      <TooltipContentPrimitive
        className={cn(
          popupMotion(),
          "bg-foreground text-background pointer-events-none z-50 w-fit max-w-xs rounded-md px-3 py-1.5 text-xs",
          className
        )}
        {...props}
      />
    </PopupPlace>
  );
}

export { Tooltip, TooltipContent, TooltipTrigger };
