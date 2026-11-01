/**
 * WARNING: If you want to use select in dialog, sheet, or any modal component, use DropdownMenu instead.
 */

import { Select as SelectPrimitive } from "@base-ui/react/select";
import {
  ArrowDown01Icon,
  ArrowUp01Icon,
  Tick01Icon,
} from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { PortalContainer } from "@repo/design-system/lib/portal";
import { cva } from "class-variance-authority";
import { cn } from "cn";
import { Array as Arr } from "effect";
import type * as React from "react";
import { use } from "react";
import { useTranslations } from "use-intl";

/**
 * A select. One with nothing to choose from stays shut, since it would open on an empty line: its caller says what
 * must happen first.
 */
function Select<Value, Multiple extends boolean | undefined = false>({
  disabled,
  items,
  ...props
}: SelectPrimitive.Root.Props<Value, Multiple>) {
  return (
    <SelectPrimitive.Root
      disabled={disabled || (Arr.Array.isArray(items) && items.length === 0)}
      items={items}
      {...props}
    />
  );
}

function SelectGroup({ className, ...props }: SelectPrimitive.Group.Props) {
  return (
    <SelectPrimitive.Group
      className={cn("scroll-my-1 p-1", className)}
      data-slot="select-group"
      {...props}
    />
  );
}

/**
 * The chosen item in the trigger, on one line: a label longer than the trigger ends in an ellipsis, so it never
 * pushes the text or the chevron past the trigger's border. The value is a block, where the ellipsis draws, and
 * an item drawn with an icon, such as a flag, keeps the icon inline before its label: Base UI copies the item's
 * nodes into the value, the label often as bare text, which a row of flex items could not end in an ellipsis.
 */
const selectValueVariants = cva(
  "min-w-0 flex-1 truncate text-left [&>svg]:me-2 [&>svg]:inline-block [&>svg]:align-[-0.1875em]"
);

function SelectValue({
  className,
  labels,
  ...props
}: SelectPrimitive.Value.Props & {
  /**
   * Every label the select can show, given where its value changes on its own, as a playing lab's time does: the
   * value keeps the widest label's width, so the trigger never grows and nothing beside it moves. Each label is
   * drawn as generated content of an empty, hidden cell, so the trigger's text and name stay its value alone.
   */
  labels?: readonly string[];
}) {
  if (labels === undefined) {
    return (
      <SelectPrimitive.Value
        className={selectValueVariants({ className })}
        data-slot="select-value"
        {...props}
      />
    );
  }

  return (
    <span className="grid min-w-0 flex-1" data-slot="select-value-frame">
      {Arr.map(labels, (label) => (
        <span
          aria-hidden="true"
          className={selectValueVariants({
            className:
              "invisible col-start-1 row-start-1 before:content-[attr(data-label)]",
          })}
          data-label={label}
          key={label}
        />
      ))}
      <SelectPrimitive.Value
        className={selectValueVariants({
          className: cn("col-start-1 row-start-1", className),
        })}
        data-slot="select-value"
        {...props}
      />
    </span>
  );
}

/** The look of a select's button, which a picker with a search box of its own wears too. */
const selectTriggerVariants = cva(
  "border-input focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 data-placeholder:text-muted-foreground dark:aria-invalid:ring-destructive/40 flex max-w-full min-w-0 cursor-pointer items-center justify-between gap-2 rounded-md border bg-transparent px-3 py-2 text-sm whitespace-nowrap shadow-xs transition-[color,box-shadow] ease-out outline-none focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-50 data-[size=default]:h-9 data-[size=sm]:h-8 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    defaultVariants: { width: "fit" },
    variants: { width: { fit: "w-fit", full: "w-full" } },
  }
);

function SelectTrigger({
  className,
  size = "default",
  children,
  ...props
}: SelectPrimitive.Trigger.Props & {
  size?: "sm" | "default";
}) {
  return (
    <SelectPrimitive.Trigger
      className={cn(selectTriggerVariants(), className)}
      data-size={size}
      data-slot="select-trigger"
      {...props}
    >
      {children}
      <SelectPrimitive.Icon>
        <HugeIcons
          className="size-4 text-inherit opacity-80"
          icon={ArrowDown01Icon}
        />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

function SelectContent({
  className,
  children,
  side = "bottom",
  sideOffset = 4,
  align = "center",
  alignOffset = 0,
  alignItemWithTrigger = true,
  ...props
}: SelectPrimitive.Popup.Props &
  Pick<
    SelectPrimitive.Positioner.Props,
    "align" | "alignOffset" | "alignItemWithTrigger" | "side" | "sideOffset"
  >) {
  return (
    <SelectPrimitive.Portal container={use(PortalContainer)}>
      <SelectPrimitive.Positioner
        align={align}
        alignItemWithTrigger={alignItemWithTrigger}
        alignOffset={alignOffset}
        className="isolate z-50"
        side={side}
        sideOffset={sideOffset}
      >
        <SelectPrimitive.Popup
          className={cn(
            "data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:fade-in-0 data-open:zoom-in-95 data-closed:fade-out-0 data-closed:zoom-out-95 bg-popover text-popover-foreground duration-ui motion-safe:data-closed:animate-out motion-safe:data-open:animate-in relative isolate z-50 max-h-(--available-height) w-max max-w-(--available-width) min-w-(--anchor-width) origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-md border shadow-md inset-shadow-[0_-1px_--theme(--color-black/4%)] ease-out not-dark:bg-clip-padding data-[align-trigger=true]:animate-none dark:inset-shadow-[0_1px_--theme(--color-white/6%)]",
            className
          )}
          data-align-trigger={alignItemWithTrigger}
          data-slot="select-content"
          {...props}
        >
          <SelectScrollUpButton />
          <SelectPrimitive.List>{children}</SelectPrimitive.List>
          <SelectNothing />
          <SelectScrollDownButton />
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  );
}

/**
 * What a list says with nothing to choose, in the words of the caller who knows what to do first. A
 * list that holds none of these says so by itself (`SelectNothing`).
 */
function SelectEmpty({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      className={cn(
        "text-muted-foreground max-w-xs px-2 py-1.5 text-sm",
        className
      )}
      data-slot="select-empty"
      {...props}
    />
  );
}

/**
 * The sentence of a list with no item and no `SelectEmpty`, so a select never opens on a thin
 * empty line, however its caller fills it.
 */
function SelectNothing() {
  const t = useTranslations("Common");

  return (
    <p className="text-muted-foreground hidden max-w-xs px-2 py-1.5 text-sm [[data-slot=select-content]:not(:has([data-slot=select-item],[data-slot=select-empty]))_&]:block">
      {t("popup-empty")}
    </p>
  );
}

function SelectLabel({
  className,
  ...props
}: SelectPrimitive.GroupLabel.Props) {
  return (
    <SelectPrimitive.GroupLabel
      className={cn("text-muted-foreground px-2 py-1.5 text-xs", className)}
      data-slot="select-label"
      {...props}
    />
  );
}

function SelectItem({
  className,
  children,
  ...props
}: SelectPrimitive.Item.Props) {
  return (
    <SelectPrimitive.Item
      className={cn(
        "focus:bg-accent focus:text-accent-foreground [&_svg:not([class*='text-'])]:text-muted-foreground focus:[&_svg:not([class*='text-'])]:text-accent-foreground relative flex w-full items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm outline-hidden select-none data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 *:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2",
        className
      )}
      data-slot="select-item"
      {...props}
    >
      <SelectPrimitive.ItemText className="flex min-w-0 flex-1 items-center gap-2 text-pretty">
        {children}
      </SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator
        render={
          <span className="pointer-events-none absolute right-2 flex size-3.5 items-center justify-center" />
        }
      >
        <HugeIcons className="size-4" icon={Tick01Icon} />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  );
}

function SelectSeparator({
  className,
  ...props
}: SelectPrimitive.Separator.Props) {
  return (
    <SelectPrimitive.Separator
      className={cn("bg-border pointer-events-none -mx-1 my-1 h-px", className)}
      data-slot="select-separator"
      {...props}
    />
  );
}

function SelectScrollUpButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollUpArrow>) {
  return (
    <SelectPrimitive.ScrollUpArrow
      className={cn(
        "bg-popover top-0 z-10 flex w-full cursor-default items-center justify-center py-1",
        className
      )}
      data-slot="select-scroll-up-button"
      {...props}
    >
      <HugeIcons className="size-4" icon={ArrowUp01Icon} />
    </SelectPrimitive.ScrollUpArrow>
  );
}

function SelectScrollDownButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollDownArrow>) {
  return (
    <SelectPrimitive.ScrollDownArrow
      className={cn(
        "bg-popover bottom-0 z-10 flex w-full cursor-default items-center justify-center py-1",
        className
      )}
      data-slot="select-scroll-down-button"
      {...props}
    >
      <HugeIcons className="size-4" icon={ArrowDown01Icon} />
    </SelectPrimitive.ScrollDownArrow>
  );
}

export {
  Select,
  SelectContent,
  SelectEmpty,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
  selectTriggerVariants,
};
