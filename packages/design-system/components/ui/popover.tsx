import { PopupPlace } from "@repo/design-system/components/ui/popup-place";
import { SheetGrip } from "@repo/design-system/components/ui/sheet-grip";
import {
  PopupContainer,
  popupMotion,
  sheetSurface,
} from "@repo/design-system/lib/popup";
import type { NodeChildren } from "@repo/design-system/lib/render";
import {
  createPopoverController as createPopoverControllerPrimitive,
  PopoverContent as PopoverContentPrimitive,
  PopoverDescription as PopoverDescriptionPrimitive,
  Popover as PopoverPrimitive,
  PopoverTitle as PopoverTitlePrimitive,
  PopoverTrigger as PopoverTriggerPrimitive,
} from "@ui-sdk/react/popover";
import { cn } from "cn";
import type * as React from "react";
import { use } from "react";

/**
 * A small floating panel under its trigger, for a short form or details. Its header, body and footer keep one
 * padding, and a padded child never adds its own. On a phone it rises from the bottom as a sheet, with the sheet's
 * grip, as every menu and dialog does, and floats under its trigger elsewhere. A popover that types into a field
 * outside it, as a keypad or a list of mentions does, passes `presentation="popover"`, so the field stays in view and
 * keeps the caret, and so does a note that opens on its own beside its control.
 */
function Popover({
  presentation = "auto",
  ...props
}: React.ComponentProps<typeof PopoverPrimitive>) {
  return (
    <PopoverPrimitive
      container={use(PopupContainer)}
      presentation={presentation}
      {...props}
    />
  );
}

/**
 * Opens or closes a popover from code. A popover that renders open leaves the focus where it is, so one that opens as
 * it mounts, for a press that came before its code, opens through this and takes the focus as a press would.
 */
function createPopoverController() {
  return createPopoverControllerPrimitive();
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
    <PopupPlace>
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
    </PopupPlace>
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
  createPopoverController,
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
};
