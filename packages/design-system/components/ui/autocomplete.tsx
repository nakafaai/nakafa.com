"use client";

import { Autocomplete as AutocompletePrimitive } from "@base-ui/react/autocomplete";
import { ArrowDown01Icon, Cancel01Icon } from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { ScrollArea } from "@repo/design-system/components/ui/scroll-area";
import { cn } from "@repo/design-system/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

const autocompleteInputVariants = cva(
  "flex w-full min-w-0 rounded-md border border-input bg-transparent text-sm shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20",
  {
    defaultVariants: {
      size: "default",
    },
    variants: {
      size: {
        default: "h-9 px-3 py-1",
        lg: "h-10 px-3 py-2",
        sm: "h-8 px-2.5 py-1",
      },
    },
  }
);

type AutocompleteInputProps = Omit<AutocompletePrimitive.Input.Props, "size"> &
  VariantProps<typeof autocompleteInputVariants> & {
    clearProps?: AutocompletePrimitive.Clear.Props;
    showClear?: boolean;
    showTrigger?: boolean;
    startAddon?: React.ReactNode;
    triggerProps?: AutocompletePrimitive.Trigger.Props;
  };

const Autocomplete = AutocompletePrimitive.Root;

function AutocompleteInput({
  className,
  clearProps,
  showClear = false,
  showTrigger = false,
  size,
  startAddon,
  triggerProps,
  ...props
}: AutocompleteInputProps) {
  return (
    <AutocompletePrimitive.InputGroup
      className="relative flex w-full min-w-0 items-center text-foreground data-disabled:opacity-64"
      data-slot="autocomplete-input-group"
    >
      {!!startAddon && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-s-px inset-y-0 z-10 flex items-center ps-[calc(--spacing(3)-1px)] text-muted-foreground opacity-80 has-[+[data-size=sm]]:ps-[calc(--spacing(2.5)-1px)] [&_svg:not([class*='size-'])]:size-4.5 sm:[&_svg:not([class*='size-'])]:size-4 [&_svg]:-mx-0.5 [&_svg]:shrink-0"
          data-slot="autocomplete-start-addon"
        >
          {startAddon}
        </span>
      )}
      <AutocompletePrimitive.Input
        className={cn(
          autocompleteInputVariants({ size }),
          !!startAddon &&
            "ps-[calc(--spacing(8.5)-1px)] sm:ps-[calc(--spacing(8)-1px)]",
          (showClear || showTrigger) && "pe-9",
          className
        )}
        data-slot="autocomplete-input"
        {...props}
      />
      {!!showTrigger && (
        <AutocompleteTrigger
          className="absolute inset-e-0.5 top-1/2 inline-flex size-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md border border-transparent text-muted-foreground opacity-80 outline-none transition-colors pointer-coarse:after:absolute pointer-coarse:after:min-h-11 pointer-coarse:after:min-w-11 hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring sm:size-7"
          {...triggerProps}
        >
          <AutocompletePrimitive.Icon data-slot="autocomplete-icon">
            <HugeIcons icon={ArrowDown01Icon} />
          </AutocompletePrimitive.Icon>
        </AutocompleteTrigger>
      )}
      {!!showClear && (
        <AutocompleteClear
          className="not-data-visible:pointer-events-none absolute inset-e-0.5 top-1/2 inline-flex size-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md border border-transparent text-muted-foreground not-data-visible:opacity-0 opacity-80 outline-none transition-[color,background-color,box-shadow,opacity] pointer-coarse:after:absolute pointer-coarse:after:min-h-11 pointer-coarse:after:min-w-11 hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:transition-none data-ending-style:opacity-0 data-starting-style:opacity-0 sm:size-7"
          keepMounted
          {...clearProps}
        />
      )}
    </AutocompletePrimitive.InputGroup>
  );
}

function AutocompletePopup({
  align = "start",
  alignOffset,
  anchor,
  children,
  className,
  portalProps,
  side = "bottom",
  sideOffset = 4,
  ...props
}: AutocompletePrimitive.Popup.Props & {
  align?: AutocompletePrimitive.Positioner.Props["align"];
  alignOffset?: AutocompletePrimitive.Positioner.Props["alignOffset"];
  anchor?: AutocompletePrimitive.Positioner.Props["anchor"];
  portalProps?: AutocompletePrimitive.Portal.Props;
  side?: AutocompletePrimitive.Positioner.Props["side"];
  sideOffset?: AutocompletePrimitive.Positioner.Props["sideOffset"];
}) {
  return (
    <AutocompletePrimitive.Portal {...portalProps}>
      <AutocompletePrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        anchor={anchor}
        className="z-50 select-none outline-none"
        data-slot="autocomplete-positioner"
        side={side}
        sideOffset={sideOffset}
      >
        <AutocompletePrimitive.Popup
          className={cn(
            "relative inset-shadow-[0_-1px_--theme(--color-black/4%)] flex max-h-[min(var(--available-height),23rem)] min-w-(--anchor-width) max-w-(--available-width) origin-(--transform-origin) flex-col overflow-hidden rounded-lg border bg-popover not-dark:bg-clip-padding text-popover-foreground shadow-md outline-none transition-[scale,opacity] data-ending-style:scale-95 data-starting-style:scale-95 data-ending-style:opacity-0 data-starting-style:opacity-0 dark:inset-shadow-[0_1px_--theme(--color-white/6%)]",
            className
          )}
          data-slot="autocomplete-popup"
          {...props}
        >
          {children}
        </AutocompletePrimitive.Popup>
      </AutocompletePrimitive.Positioner>
    </AutocompletePrimitive.Portal>
  );
}

function AutocompleteList({
  className,
  scrollArea = true,
  scrollAreaClassName,
  ...props
}: AutocompletePrimitive.List.Props & {
  scrollArea?: boolean;
  scrollAreaClassName?: string;
}) {
  const list = (
    <AutocompletePrimitive.List
      className={cn(
        "max-h-full scroll-py-1 overflow-y-auto overflow-x-hidden p-1 data-empty:p-0",
        "not-empty:scroll-py-1 not-empty:p-1 in-data-has-overflow-y:pe-3",
        className
      )}
      data-slot="autocomplete-list"
      {...props}
    />
  );

  if (!scrollArea) {
    return list;
  }

  return (
    <ScrollArea
      className={cn("min-h-0 flex-1", scrollAreaClassName)}
      scrollbarGutter
      scrollFade
    >
      {list}
    </ScrollArea>
  );
}

function AutocompleteItem({
  className,
  ...props
}: AutocompletePrimitive.Item.Props) {
  return (
    <AutocompletePrimitive.Item
      className={cn(
        "relative flex min-h-8 cursor-default select-none items-center gap-2 rounded-sm px-2 py-1 text-base outline-none data-disabled:pointer-events-none data-highlighted:bg-accent data-highlighted:text-accent-foreground data-disabled:opacity-64 sm:min-h-7 sm:text-sm [&_svg:not([class*='size-'])]:size-4.5 sm:[&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground data-highlighted:[&_svg:not([class*='text-'])]:text-accent-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0",
        className
      )}
      data-slot="autocomplete-item"
      {...props}
    />
  );
}

function AutocompleteEmpty({
  className,
  ...props
}: AutocompletePrimitive.Empty.Props) {
  return (
    <AutocompletePrimitive.Empty
      className={cn(
        "not-empty:p-2 text-center text-base text-muted-foreground sm:text-sm",
        className
      )}
      data-slot="autocomplete-empty"
      {...props}
    />
  );
}

function AutocompleteGroup({
  className,
  ...props
}: AutocompletePrimitive.Group.Props) {
  return (
    <AutocompletePrimitive.Group
      className={cn("text-foreground [[role=group]+&]:mt-1.5", className)}
      data-slot="autocomplete-group"
      {...props}
    />
  );
}

function AutocompleteGroupLabel({
  className,
  ...props
}: AutocompletePrimitive.GroupLabel.Props) {
  return (
    <AutocompletePrimitive.GroupLabel
      className={cn("px-2 py-1.5 text-muted-foreground text-xs", className)}
      data-slot="autocomplete-group-label"
      {...props}
    />
  );
}

function AutocompleteCollection({
  ...props
}: AutocompletePrimitive.Collection.Props) {
  return (
    <AutocompletePrimitive.Collection
      data-slot="autocomplete-collection"
      {...props}
    />
  );
}

function AutocompleteSeparator({
  className,
  ...props
}: AutocompletePrimitive.Separator.Props) {
  return (
    <AutocompletePrimitive.Separator
      className={cn("mx-2 my-1 h-px bg-border last:hidden", className)}
      data-slot="autocomplete-separator"
      {...props}
    />
  );
}

function AutocompleteClear({
  className,
  children,
  ...props
}: AutocompletePrimitive.Clear.Props) {
  return (
    <AutocompletePrimitive.Clear
      className={cn(
        "not-data-visible:pointer-events-none inline-flex size-8 cursor-pointer items-center justify-center rounded-md border border-transparent not-data-visible:opacity-0 opacity-80 outline-none transition-[color,background-color,box-shadow,opacity] pointer-coarse:after:absolute pointer-coarse:after:min-h-11 pointer-coarse:after:min-w-11 hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:transition-none sm:size-7 [&_svg:not([class*='size-'])]:size-4.5 sm:[&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0",
        className
      )}
      data-slot="autocomplete-clear"
      {...props}
    >
      {children ?? <HugeIcons icon={Cancel01Icon} />}
    </AutocompletePrimitive.Clear>
  );
}

function AutocompleteTrigger({
  className,
  ...props
}: AutocompletePrimitive.Trigger.Props) {
  return (
    <AutocompletePrimitive.Trigger
      className={className}
      data-slot="autocomplete-trigger"
      {...props}
    />
  );
}

function AutocompleteStatus({
  className,
  ...props
}: AutocompletePrimitive.Status.Props) {
  return (
    <AutocompletePrimitive.Status
      className={cn(
        "px-3 py-2 text-muted-foreground text-xs empty:m-0 empty:p-0",
        className
      )}
      data-slot="autocomplete-status"
      {...props}
    />
  );
}

function AutocompleteValue({ ...props }: AutocompletePrimitive.Value.Props) {
  return (
    <AutocompletePrimitive.Value data-slot="autocomplete-value" {...props} />
  );
}

function AutocompleteRow({ ...props }: AutocompletePrimitive.Row.Props) {
  return <AutocompletePrimitive.Row data-slot="autocomplete-row" {...props} />;
}

const useAutocompleteFilter = AutocompletePrimitive.useFilter;

export {
  Autocomplete,
  AutocompleteClear,
  AutocompleteCollection,
  AutocompleteEmpty,
  AutocompleteGroup,
  AutocompleteGroupLabel,
  AutocompleteInput,
  AutocompleteItem,
  AutocompleteList,
  AutocompletePopup,
  AutocompleteRow,
  AutocompleteSeparator,
  AutocompleteStatus,
  AutocompleteTrigger,
  AutocompleteValue,
  useAutocompleteFilter,
};
