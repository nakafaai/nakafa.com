import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import { ScrollArea } from "@repo/design-system/components/ui/scroll-area";
import { cn } from "cn";
import type { ComponentProps, ReactNode } from "react";

/**
 * A list of mention choices anchored at the caret of a text field (ADR 0025): Base UI's Positioner
 * with a virtual anchor, and a listbox. It is not modal and takes no focus, so the field keeps the
 * caret while the list is open, and the field moves the active choice with the arrow keys. It opens
 * above the caret line, so it never covers the word being typed, and it stays inside the viewport.
 */
export function MentionPopup({
  anchor,
  children,
  id,
  label,
  onClose,
  open,
}: {
  anchor: PopoverPrimitive.Positioner.Props["anchor"];
  children: ReactNode;
  /** The ID of the listbox, which the field names in `aria-controls`. */
  id: string;
  label: string;
  onClose: () => void;
  open: boolean;
}) {
  return (
    <PopoverPrimitive.Root
      modal={false}
      onOpenChange={(next) => {
        if (!next) {
          onClose();
        }
      }}
      open={open}
    >
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Positioner
          align="start"
          anchor={anchor}
          className="isolate z-50"
          collisionPadding={8}
          side="top"
          sideOffset={6}
        >
          <PopoverPrimitive.Popup
            className="flex max-h-64 w-64 max-w-[calc(100vw-1rem)] origin-(--transform-origin) flex-col overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md outline-hidden"
            data-slot="mention-popup"
            finalFocus={false}
            initialFocus={false}
          >
            <ScrollArea>
              <div
                aria-label={label}
                className="flex flex-col p-1"
                id={id}
                role="listbox"
              >
                {children}
              </div>
            </ScrollArea>
          </PopoverPrimitive.Popup>
        </PopoverPrimitive.Positioner>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

/**
 * One choice of the mention list. A press picks it as the pointer goes down, without taking the
 * focus from the field, which owns the keys of the list; the active choice, which Enter picks, is
 * marked for the eye and for assistive technology.
 */
export function MentionOption({
  active,
  className,
  onPick,
  ...props
}: Omit<ComponentProps<"div">, "onPointerDown"> & {
  active: boolean;
  onPick: () => void;
}) {
  return (
    // The field keeps the focus, so a choice is focusable only by script, never by Tab.
    <div
      aria-selected={active}
      className={cn(
        "wrap-anywhere cursor-default rounded-sm px-2 py-1.5 text-sm data-[active=true]:bg-accent data-[active=true]:text-accent-foreground",
        className
      )}
      data-active={active}
      data-slot="mention-option"
      onPointerDown={(event) => {
        event.preventDefault();
        onPick();
      }}
      role="option"
      tabIndex={-1}
      {...props}
    />
  );
}
