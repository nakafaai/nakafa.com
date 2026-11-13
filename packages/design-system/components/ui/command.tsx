import type { AutocompleteRootProps } from "@base-ui/react/autocomplete";
import { Dialog as CommandDialogPrimitive } from "@base-ui/react/dialog";
import { Drawer as DrawerPrimitive } from "@base-ui/react/drawer";
import { useMediaQuery } from "@base-ui/react/unstable-use-media-query";
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
import {
  Drawer,
  DrawerContent,
} from "@repo/design-system/components/ui/drawer";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { TAILWIND_MEDIA_QUERIES } from "@repo/design-system/lib/breakpoints";
import { ButtonGroupVariant } from "@repo/design-system/lib/group";
import { cn } from "cn";
import { Array as Arr, Predicate } from "effect";
import type * as React from "react";
import { createContext, use, useRef } from "react";

/** Whether the palette opens as a dialog, from the medium breakpoint, or as a drawer on a phone. */
const CommandSurfaceContext = createContext<"dialog" | "drawer">("dialog");

/**
 * Opens a command palette: a dialog over the page from the medium breakpoint, and
 * on a phone a drawer with the search at its top, its handle and no close button,
 * as every searchable choice opens there (`Picker`).
 */
function CommandDialog({
  children,
  onOpenChange,
  open,
}: {
  children: React.ReactNode;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  const isDesktop = useMediaQuery(TAILWIND_MEDIA_QUERIES.mdAndUp, {});
  if (isDesktop) {
    return (
      <CommandSurfaceContext value="dialog">
        <CommandDialogPrimitive.Root
          onOpenChange={(next) => onOpenChange(next)}
          open={open}
        >
          {children}
        </CommandDialogPrimitive.Root>
      </CommandSurfaceContext>
    );
  }
  return (
    <CommandSurfaceContext value="drawer">
      <Drawer onOpenChange={(next) => onOpenChange(next)} open={open}>
        {children}
      </Drawer>
    </CommandSurfaceContext>
  );
}

const CommandDialogPortal = CommandDialogPrimitive.Portal;
const CommandDialogCreateHandle = CommandDialogPrimitive.createHandle;

type CommandProps<ItemValue> = Omit<
  AutocompleteRootProps<ItemValue>,
  "items"
> & {
  items?: readonly ItemValue[] | readonly { items: readonly ItemValue[] }[];
};

function hasGroupedItems(value: unknown) {
  return (
    Predicate.isObject(value) &&
    Predicate.hasProperty(value, "items") &&
    Arr.isArray(value.items)
  );
}

function isGroupedCommandItems<ItemValue>(
  items: CommandProps<ItemValue>["items"]
): items is readonly { items: readonly ItemValue[] }[] {
  return Arr.isArray(items) && Arr.some(items, hasGroupedItems);
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
        // The palette opens from the keyboard, so it appears and leaves at
        // once: an action from the keyboard is never animated.
        "fixed inset-0 z-50 bg-black/32 backdrop-blur-sm",
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
  description,
  portalProps,
  title,
  ...props
}: CommandDialogPrimitive.Popup.Props & {
  /** What a screen reader reads under the title, in the reader's language. */
  description: React.ReactNode;
  portalProps?: CommandDialogPrimitive.Portal.Props;
  /** The name of the dialog, in the reader's language. */
  title: React.ReactNode;
}) {
  const body = useRef<HTMLDivElement>(null);
  if (use(CommandSurfaceContext) === "drawer") {
    // As a `Picker` drawer does: a press focuses the search field, and a touch
    // focuses the drawer itself, so no keyboard covers the rows before the
    // learner asks for it.
    return (
      <DrawerPrimitive.VirtualKeyboardProvider>
        <DrawerContent
          className="[--drawer-content-height:calc(100dvh-6rem)]"
          initialFocus={(type) =>
            type === "touch"
              ? body.current
              : (body.current?.querySelector("input") ?? true)
          }
        >
          <DrawerPrimitive.Title className="sr-only">
            {title}
          </DrawerPrimitive.Title>
          <DrawerPrimitive.Description className="sr-only">
            {description}
          </DrawerPrimitive.Description>
          <div
            className="flex min-h-0 flex-1 flex-col outline-none"
            ref={body}
            tabIndex={-1}
          >
            {children}
          </div>
        </DrawerContent>
      </DrawerPrimitive.VirtualKeyboardProvider>
    );
  }
  return (
    <ButtonGroupVariant value={undefined}>
      <CommandDialogPortal {...portalProps}>
        <CommandDialogBackdrop />
        <CommandDialogViewport>
          <CommandDialogPrimitive.Popup
            className={cn(
              "bg-popover text-popover-foreground duration-surface before:bg-muted/72 relative isolate row-start-2 flex h-[min(40rem,calc(100dvh-2rem))] min-h-0 w-full max-w-xl min-w-0 translate-y-[calc(-1.25rem*var(--nested-dialogs))] scale-[calc(1-0.1*var(--nested-dialogs))] flex-col overflow-hidden rounded-2xl border opacity-[calc(1-0.1*var(--nested-dialogs))] shadow-lg/5 transition-[scale,opacity,translate] outline-none *:relative *:z-10 not-dark:bg-clip-padding before:pointer-events-none before:absolute before:inset-0 before:z-0 before:rounded-[calc(var(--radius-2xl)-1px)] before:shadow-[0_1px_--theme(--color-black/4%)] data-nested:data-ending-style:translate-y-8 data-nested-dialog-open:origin-top data-nested:data-starting-style:translate-y-8 **:data-[slot=scroll-area-viewport]:data-has-overflow-y:pe-1 sm:h-[min(40rem,80dvh)] dark:before:shadow-[0_-1px_--theme(--color-white/6%)]",
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
    </ButtonGroupVariant>
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

/**
 * The search field of a command dialog. It does not autofocus: a kept-mounted dialog
 * mounts hidden, so the dialog takes focus when it opens, through its `initialFocus`.
 */
function CommandInput({
  className,
  showClear = true,
  ...props
}: React.ComponentProps<typeof AutocompleteInput> & {
  /** What the box shows while empty, which says what to search for. */
  placeholder: string;
}) {
  return (
    <div className="px-2.5 py-1.5" data-slot="command-input-wrapper">
      <AutocompleteInput
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
        "bg-popover relative -mx-px flex min-h-0 flex-1 flex-col overflow-hidden rounded-t-xl border border-b-0 bg-clip-padding shadow-xs/5 not-has-[+[data-slot=command-footer]]:-mb-px not-has-[+[data-slot=command-footer]]:rounded-b-2xl before:pointer-events-none before:absolute before:inset-0 before:rounded-t-[calc(var(--radius-xl)-1px)] **:data-[slot=scroll-area-scrollbar]:mt-2",
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
      className={cn("not-empty:py-6", className)}
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
      className={cn("-mx-2 my-2", className)}
      data-slot="command-separator"
      {...props}
    />
  );
}

function CommandShortcut({ className, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      className={cn(
        "text-muted-foreground ms-auto font-sans text-xs tracking-widest",
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
        "bg-popover text-muted-foreground flex items-center justify-between gap-2 rounded-b-[calc(var(--radius-2xl)-1px)] border-t px-5 py-3 text-sm",
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
