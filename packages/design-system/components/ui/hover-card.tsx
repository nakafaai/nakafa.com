import { ButtonGroupVariant } from "@repo/design-system/lib/group";
import { PopupContainer, popupMotion } from "@repo/design-system/lib/popup";
import {
  HoverCardContent as HoverCardContentPrimitive,
  HoverCard as HoverCardPrimitive,
  HoverCardTrigger as HoverCardTriggerPrimitive,
} from "@ui-sdk/react/hover-card";
import { cn } from "cn";
import type * as React from "react";
import { use } from "react";

/**
 * A preview that opens while a pointer rests on its trigger, such as a person's card over their name. It holds
 * nothing a reader needs to act on, since touch screens never hover.
 */
function HoverCard({
  closeDelay = 0,
  delay = 0,
  ...props
}: React.ComponentProps<typeof HoverCardPrimitive>) {
  return (
    <HoverCardPrimitive
      closeDelay={closeDelay}
      container={use(PopupContainer)}
      delay={delay}
      {...props}
    />
  );
}

function HoverCardTrigger(
  props: React.ComponentProps<typeof HoverCardTriggerPrimitive>
) {
  return <HoverCardTriggerPrimitive {...props} />;
}

function HoverCardContent({
  className,
  side = "bottom",
  ...props
}: React.ComponentProps<typeof HoverCardContentPrimitive>) {
  return (
    <ButtonGroupVariant value={undefined}>
      <HoverCardContentPrimitive
        className={cn(
          popupMotion(),
          "bg-popover text-popover-foreground z-50 w-64 rounded-md border p-4 shadow-md outline-hidden",
          className
        )}
        side={side}
        {...props}
      />
    </ButtonGroupVariant>
  );
}

export { HoverCard, HoverCardContent, HoverCardTrigger };
