import { Autocomplete as AutocompletePrimitive } from "@base-ui/react/autocomplete";
import { ArrowDown01Icon, Cancel01Icon } from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { ScrollArea } from "@repo/design-system/components/ui/scroll-area";
import { PortalContainer } from "@repo/design-system/lib/portal";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import type * as React from "react";
import { use } from "react";

const autocompleteInputVariants = cva(
  "border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 flex w-full min-w-0 rounded-md border bg-transparent text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-3 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
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
    /** The name of the clear button when `showClear` is set, in the reader's language. */
    clearLabel?: string;
    clearProps?: AutocompletePrimitive.Clear.Props;
    showClear?: boolean;
    showTrigger?: boolean;
    startAddon?: React.ReactNode;
    /** The name of the trigger button when `showTrigger` is set, in the reader's language. */
    triggerLabel?: string;
    triggerProps?: AutocompletePrimitive.Trigger.Props;
  };

const Autocomplete = AutocompletePrimitive.Root;

function AutocompleteInput({
  className,
  clearLabel,
  clearProps,
  showClear = false,
  showTrigger = false,
  size,
  startAddon,
  triggerLabel,
  triggerProps,
  ...props
}: AutocompleteInputProps) {
  return (
    <AutocompletePrimitive.InputGroup
      className="text-foreground relative flex w-full min-w-0 items-center data-disabled:opacity-64"
      data-slot="autocomplete-input-group"
    >
      {!!startAddon && (
        <span
          aria-hidden="true"
          className="text-muted-foreground pointer-events-none absolute inset-y-0 inset-s-px z-10 flex items-center ps-[calc(--spacing(3)-1px)] opacity-80 has-[+[data-size=sm]]:ps-[calc(--spacing(2.5)-1px)] [&_svg]:-mx-0.5 [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4.5 sm:[&_svg:not([class*='size-'])]:size-4"
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
          aria-label={triggerLabel}
          className="text-muted-foreground focus-visible:ring-ring absolute inset-e-0.5 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-md border border-transparent opacity-80 transition-colors outline-none hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 sm:size-7 pointer-coarse:after:absolute pointer-coarse:after:min-h-11 pointer-coarse:after:min-w-11"
          {...triggerProps}
        >
          <AutocompletePrimitive.Icon data-slot="autocomplete-icon">
            <HugeIcons icon={ArrowDown01Icon} />
          </AutocompletePrimitive.Icon>
        </AutocompleteTrigger>
      )}
      {!!showClear && (
        <AutocompleteClear
          aria-label={clearLabel}
          className="text-muted-foreground focus-visible:ring-ring absolute inset-e-0.5 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-md border border-transparent opacity-80 transition-[scale,color,background-color,box-shadow,opacity] outline-none not-data-visible:pointer-events-none not-data-visible:opacity-0 hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:transition-none data-ending-style:opacity-0 data-starting-style:opacity-0 sm:size-7 pointer-coarse:after:absolute pointer-coarse:after:min-h-11 pointer-coarse:after:min-w-11"
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
    <AutocompletePrimitive.Portal
      container={use(PortalContainer)}
      {...portalProps}
    >
      <AutocompletePrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        anchor={anchor}
        className="z-50 outline-none select-none"
        data-slot="autocomplete-positioner"
        side={side}
        sideOffset={sideOffset}
      >
        <AutocompletePrimitive.Popup
          className={cn(
            "bg-popover text-popover-foreground relative flex max-h-[min(var(--available-height),23rem)] max-w-(--available-width) min-w-(--anchor-width) origin-(--transform-origin) flex-col overflow-hidden rounded-lg border shadow-md inset-shadow-[0_-1px_--theme(--color-black/4%)] transition-[scale,opacity] outline-none not-dark:bg-clip-padding data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0 dark:inset-shadow-[0_1px_--theme(--color-white/6%)]",
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

function AutocompleteItems({
  className,
  ...props
}: AutocompletePrimitive.List.Props) {
  return (
    <AutocompletePrimitive.List
      className={cn(
        "max-h-full scroll-py-1 overflow-x-hidden overflow-y-auto p-1 data-empty:p-0",
        "not-empty:scroll-py-1 not-empty:p-1 in-data-has-overflow-y:pe-3",
        className
      )}
      data-slot="autocomplete-list"
      {...props}
    />
  );
}

function AutocompleteList({
  scrollArea = true,
  scrollAreaClassName,
  ...props
}: AutocompletePrimitive.List.Props & {
  scrollArea?: boolean;
  scrollAreaClassName?: string;
}) {
  if (!scrollArea) {
    return <AutocompleteItems {...props} />;
  }

  return (
    <ScrollArea
      className={cn("min-h-0 flex-1", scrollAreaClassName)}
      scrollFade
    >
      <AutocompleteItems {...props} />
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
        "data-highlighted:bg-accent data-highlighted:text-accent-foreground [&_svg:not([class*='text-'])]:text-muted-foreground data-highlighted:[&_svg:not([class*='text-'])]:text-accent-foreground relative flex min-h-8 items-center gap-2 rounded-sm px-2 py-1 text-base outline-none select-none data-disabled:pointer-events-none data-disabled:opacity-64 sm:min-h-7 sm:text-sm [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4.5 sm:[&_svg:not([class*='size-'])]:size-4",
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
        "text-muted-foreground text-center text-base not-empty:p-2 sm:text-sm",
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
      className={cn("text-muted-foreground px-2 py-1.5 text-xs", className)}
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
      className={cn("bg-border mx-2 my-1 h-px last:hidden", className)}
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
        "pressable focus-visible:ring-ring inline-flex size-8 items-center justify-center rounded-md border border-transparent opacity-80 transition-[scale,color,background-color,box-shadow,opacity] outline-none not-data-visible:pointer-events-none not-data-visible:opacity-0 hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:transition-none sm:size-7 pointer-coarse:after:absolute pointer-coarse:after:min-h-11 pointer-coarse:after:min-w-11 [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4.5 sm:[&_svg:not([class*='size-'])]:size-4",
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
        "text-muted-foreground px-3 py-2 text-xs empty:m-0 empty:p-0",
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
