"use client";

import type { AutocompleteRootProps } from "@base-ui/react/autocomplete";
import { Dialog as CommandDialogPrimitive } from "@base-ui/react/dialog";
import { Search02Icon } from "@hugeicons/core-free-icons";
import {
  Autocomplete,
  AutocompleteCollection,
  AutocompleteEmpty,
  AutocompleteGroup,
  AutocompleteGroupLabel,
  AutocompleteInput,
  AutocompleteItem,
  AutocompleteList,
  AutocompleteSeparator,
} from "@repo/design-system/components/ui/autocomplete";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { cn } from "@repo/design-system/lib/utils";
import type * as React from "react";

const CommandDialog = CommandDialogPrimitive.Root;
const CommandDialogPortal = CommandDialogPrimitive.Portal;
const CommandDialogCreateHandle = CommandDialogPrimitive.createHandle;

type CommandItems<ItemValue> =
  | readonly ItemValue[]
  | readonly { items: readonly ItemValue[] }[];

type CommandProps<ItemValue> = Omit<
  AutocompleteRootProps<ItemValue>,
  "items"
> & {
  items?: CommandItems<ItemValue>;
};

function hasGroupedItems(
  value: unknown
): value is { items: readonly unknown[] } {
  return (
    typeof value === "object" &&
    value !== null &&
    "items" in value &&
    Array.isArray(value.items)
  );
}

function isGroupedCommandItems<ItemValue>(
  items: CommandItems<ItemValue> | undefined
): items is readonly { items: readonly ItemValue[] }[] {
  return Array.isArray(items) && items.some(hasGroupedItems);
}

function CommandDialogTrigger(props: CommandDialogPrimitive.Trigger.Props) {
  return (
    <CommandDialogPrimitive.Trigger
      data-slot="command-dialog-trigger"
      {...props}
    />
  );
}

function CommandDialogBackdrop({
  className,
  ...props
}: CommandDialogPrimitive.Backdrop.Props) {
  return (
    <CommandDialogPrimitive.Backdrop
      className={cn(
        "fixed inset-0 z-50 bg-black/32 backdrop-blur-sm transition-all duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0",
        className
      )}
      data-slot="command-dialog-backdrop"
      {...props}
    />
  );
}

function CommandDialogViewport({
  className,
  ...props
}: CommandDialogPrimitive.Viewport.Props) {
  return (
    <CommandDialogPrimitive.Viewport
      className={cn(
        "fixed inset-0 z-50 flex flex-col items-center px-4 py-[max(--spacing(4),4vh)] sm:py-[10vh]",
        className
      )}
      data-slot="command-dialog-viewport"
      {...props}
    />
  );
}

function CommandDialogPopup({
  children,
  className,
  description = "Search for a command to run...",
  portalProps,
  title = "Command Palette",
  ...props
}: CommandDialogPrimitive.Popup.Props & {
  description?: React.ReactNode;
  portalProps?: CommandDialogPrimitive.Portal.Props;
  title?: React.ReactNode;
}) {
  return (
    <CommandDialogPortal {...portalProps}>
      <CommandDialogBackdrop />
      <CommandDialogViewport>
        <CommandDialogPrimitive.Popup
          className={cn(
            "relative isolate row-start-2 flex h-[min(40rem,calc(100dvh-2rem))] min-h-0 w-full min-w-0 max-w-xl translate-y-[calc(-1.25rem*var(--nested-dialogs))] scale-[calc(1-0.1*var(--nested-dialogs))] flex-col overflow-hidden rounded-2xl border bg-popover not-dark:bg-clip-padding text-popover-foreground opacity-[calc(1-0.1*var(--nested-dialogs))] shadow-lg/5 outline-none transition-[scale,opacity,translate] duration-200 ease-in-out will-change-transform *:relative *:z-10 before:pointer-events-none before:absolute before:inset-0 before:z-0 before:rounded-[calc(var(--radius-2xl)-1px)] before:bg-muted/72 before:shadow-[0_1px_--theme(--color-black/4%)] data-nested:data-ending-style:translate-y-8 data-nested:data-starting-style:translate-y-8 data-nested-dialog-open:origin-top data-ending-style:scale-98 data-starting-style:scale-98 data-ending-style:opacity-0 data-starting-style:opacity-0 **:data-[slot=scroll-area-viewport]:data-has-overflow-y:pe-1 sm:h-[min(40rem,80dvh)] dark:before:shadow-[0_-1px_--theme(--color-white/6%)]",
            className
          )}
          data-slot="command-dialog-popup"
          {...props}
        >
          <CommandDialogPrimitive.Title className="sr-only">
            {title}
          </CommandDialogPrimitive.Title>
          <CommandDialogPrimitive.Description className="sr-only">
            {description}
          </CommandDialogPrimitive.Description>
          {children}
        </CommandDialogPrimitive.Popup>
      </CommandDialogViewport>
    </CommandDialogPortal>
  );
}

function Command<ItemValue>({
  autoHighlight = "always",
  keepHighlight = true,
  items,
  mode = "list",
  open = true,
  ...props
}: CommandProps<ItemValue>) {
  if (isGroupedCommandItems(items)) {
    return (
      <Autocomplete
        autoHighlight={autoHighlight}
        inline
        items={items}
        keepHighlight={keepHighlight}
        mode={mode}
        open={open}
        {...props}
      />
    );
  }

  return (
    <Autocomplete
      autoHighlight={autoHighlight}
      inline
      items={items}
      keepHighlight={keepHighlight}
      mode={mode}
      open={open}
      {...props}
    />
  );
}

function CommandInput({
  className,
  showClear = true,
  ...props
}: React.ComponentProps<typeof AutocompleteInput>) {
  return (
    <div className="px-2.5 py-1.5" data-slot="command-input-wrapper">
      <AutocompleteInput
        autoFocus
        className={cn(
          "border-transparent! bg-transparent! shadow-none before:hidden focus-visible:border-transparent focus-visible:ring-0 has-focus-visible:ring-0",
          className
        )}
        showClear={showClear}
        size="lg"
        startAddon={<HugeIcons className="size-4" icon={Search02Icon} />}
        {...props}
      />
    </div>
  );
}

function CommandPanel({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "relative -mx-px not-has-[+[data-slot=command-footer]]:-mb-px flex min-h-0 flex-1 flex-col overflow-hidden rounded-t-xl not-has-[+[data-slot=command-footer]]:rounded-b-2xl border border-b-0 bg-popover bg-clip-padding shadow-xs/5 before:pointer-events-none before:absolute before:inset-0 before:rounded-t-[calc(var(--radius-xl)-1px)] **:data-[slot=scroll-area-scrollbar]:mt-2",
        className
      )}
      data-slot="command-panel"
      {...props}
    />
  );
}

function CommandList({
  className,
  ...props
}: React.ComponentProps<typeof AutocompleteList>) {
  return (
    <AutocompleteList
      className={cn("not-empty:scroll-py-2 not-empty:p-2", className)}
      data-slot="command-list"
      {...props}
    />
  );
}

function CommandEmpty({
  className,
  ...props
}: React.ComponentProps<typeof AutocompleteEmpty>) {
  return (
    <AutocompleteEmpty
      className={cn("not-empty:py-6 empty:hidden", className)}
      data-slot="command-empty"
      {...props}
    />
  );
}

function CommandGroup({
  className,
  ...props
}: React.ComponentProps<typeof AutocompleteGroup>) {
  return (
    <AutocompleteGroup
      className={className}
      data-slot="command-group"
      {...props}
    />
  );
}

function CommandGroupLabel({
  className,
  ...props
}: React.ComponentProps<typeof AutocompleteGroupLabel>) {
  return (
    <AutocompleteGroupLabel
      className={cn("font-medium", className)}
      data-slot="command-group-label"
      {...props}
    />
  );
}

function CommandCollection({
  ...props
}: React.ComponentProps<typeof AutocompleteCollection>) {
  return <AutocompleteCollection data-slot="command-collection" {...props} />;
}

function CommandItem({
  className,
  ...props
}: React.ComponentProps<typeof AutocompleteItem>) {
  return (
    <AutocompleteItem
      className={cn(
        "min-h-11! w-full overflow-hidden rounded-md px-3 py-2.5! text-sm! sm:min-h-11! sm:py-2.5! [&_svg:not([class*='size-'])]:size-4!",
        className
      )}
      data-slot="command-item"
      {...props}
    />
  );
}

function CommandSeparator({
  className,
  ...props
}: React.ComponentProps<typeof AutocompleteSeparator>) {
  return (
    <AutocompleteSeparator
      className={cn("my-2", className)}
      data-slot="command-separator"
      {...props}
    />
  );
}

function CommandShortcut({ className, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      className={cn(
        "ms-auto font-sans text-muted-foreground/72 text-xs tracking-widest",
        className
      )}
      data-slot="command-shortcut"
      {...props}
    />
  );
}

function CommandFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2 rounded-b-[calc(var(--radius-2xl)-1px)] border-t bg-popover px-5 py-3 text-muted-foreground text-sm",
        className
      )}
      data-slot="command-footer"
      {...props}
    />
  );
}

export {
  Command,
  CommandCollection,
  CommandDialog,
  CommandDialogBackdrop,
  CommandDialogCreateHandle,
  CommandDialogPopup,
  CommandDialogPortal,
  CommandDialogTrigger,
  CommandDialogViewport,
  CommandEmpty,
  CommandFooter,
  CommandGroup,
  CommandGroupLabel,
  CommandInput,
  CommandItem,
  CommandList,
  CommandPanel,
  CommandSeparator,
  CommandShortcut,
};
