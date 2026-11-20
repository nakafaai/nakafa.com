import { SheetGrip } from "@repo/design-system/components/ui/sheet-grip";
import { ButtonGroupVariant } from "@repo/design-system/lib/group";
import { popupMotion, sheetSurface } from "@repo/design-system/lib/popup";
import type { NodeChildren } from "@repo/design-system/lib/render";
import {
  PopoverContent as PopoverContentPrimitive,
  PopoverDescription as PopoverDescriptionPrimitive,
  Popover as PopoverPrimitive,
  PopoverTitle as PopoverTitlePrimitive,
  PopoverTrigger as PopoverTriggerPrimitive,
} from "@ui-sdk/react/popover";
import { cn } from "cn";
import type * as React from "react";

/**
 * A small floating panel under its trigger, for a short form or details. Its header, body and footer keep one
 * padding, and a padded child never adds its own. A popover that passes `presentation="auto"` rises from the bottom
 * as a sheet on a phone, with the sheet's grip, and floats under its trigger elsewhere.
 */
function Popover(props: React.ComponentProps<typeof PopoverPrimitive>) {
  return <PopoverPrimitive {...props} />;
}

function PopoverTrigger(
  props: React.ComponentProps<typeof PopoverTriggerPrimitive>
) {
  return <PopoverTriggerPrimitive {...props} />;
}

function PopoverContent({
  children,
  className,
  side = "bottom",
  ...props
}: NodeChildren<React.ComponentProps<typeof PopoverContentPrimitive>>) {
  return (
    <ButtonGroupVariant value={undefined}>
      <PopoverContentPrimitive
        className={cn(
          popupMotion(),
          sheetSurface(),
          "bg-popover text-popover-foreground z-50 flex w-72 flex-col gap-2 rounded-md border p-4 shadow-md outline-hidden",
          className
        )}
        side={side}
        {...props}
      >
        <SheetGrip />
        {children}
      </PopoverContentPrimitive>
    </ButtonGroupVariant>
  );
}

function PopoverHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex flex-col gap-1 text-sm", className)}
      data-slot="popover-header"
      {...props}
    />
  );
}

function PopoverTitle({
  className,
  ...props
}: React.ComponentProps<typeof PopoverTitlePrimitive>) {
  return (
    <PopoverTitlePrimitive
      className={cn("font-medium", className)}
      {...props}
    />
  );
}

function PopoverDescription({
  className,
  ...props
}: React.ComponentProps<typeof PopoverDescriptionPrimitive>) {
  return (
    <PopoverDescriptionPrimitive
      className={cn("text-muted-foreground", className)}
      {...props}
    />
  );
}

export {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
};
