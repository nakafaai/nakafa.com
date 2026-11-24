import { Cancel01Icon, Search02Icon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { Dialog } from "@repo/design-system/components/ui/dialog";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { PopupPlace } from "@repo/design-system/components/ui/popup-place";
import { ScrollArea } from "@repo/design-system/components/ui/scroll-area";
import { SheetGrip } from "@repo/design-system/components/ui/sheet-grip";
import { optionRowVariants } from "@repo/design-system/lib/option";
import { sheetSurface } from "@repo/design-system/lib/popup";
import type {
  CommandController,
  ListAnnouncement,
} from "@ui-sdk/react/command";
import {
  CommandEmpty as CommandEmptyPrimitive,
  CommandGroupLabel as CommandGroupLabelPrimitive,
  CommandGroup as CommandGroupPrimitive,
  CommandInput as CommandInputPrimitive,
  CommandItem as CommandItemPrimitive,
  CommandList as CommandListPrimitive,
  Command as CommandPrimitive,
  CommandSeparator as CommandSeparatorPrimitive,
  createCommandController,
} from "@ui-sdk/react/command";
import {
  DialogBackdrop,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@ui-sdk/react/dialog";
import type { VariantProps } from "class-variance-authority";
import { cn } from "cn";
import type * as React from "react";
import { createContext, use, useState } from "react";
import { useTranslations } from "use-intl";

/**
 * Opens a command palette over the page: in the upper part of a wide or a mouse screen, and on a phone as a sheet
 * from the bottom with the search at its top, which closes as every sheet does, by its handle, a swipe or a press
 * outside. One tree holds both, so the palette keeps its search as the screen turns.
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
  return (
    <Dialog onOpenChange={(next) => onOpenChange(next)} open={open}>
      {children}
    </Dialog>
  );
}

/**
 * The palette's window. It opens from the keyboard, so on a wide screen it appears and leaves at once: an action from
 * the keyboard is never animated. A press focuses its search field, and a touch focuses the window itself, so no
 * keyboard covers the rows before the reader asks for it. A palette that sets `keepMounted` stays in the document
 * while closed, hidden, so its rows are ready before it opens.
 */
function CommandDialogPopup({
  children,
  className,
  description,
  keepMounted = false,
  title,
}: {
  children: React.ReactNode;
  className?: string | undefined;
  /** What a screen reader reads under the title, in the reader's language. */
  description: string;
  keepMounted?: boolean | undefined;
  /** The name of the dialog, in the reader's language. */
  title: string;
}) {
  return (
    <PopupPlace>
      <DialogBackdrop className="bg-ink/32 fixed inset-0 z-50 pointer-fine:backdrop-blur-sm" />
      <DialogContent
        className={cn(
          sheetSurface(),
          // The window is tinted, so the card of rows (`CommandPanel`) stands out of it in the popup's own colour.
          "text-popover-foreground z-50 flex min-h-0 w-full flex-col overflow-clip border bg-[color-mix(in_oklab,var(--muted)_72%,var(--popover))] outline-none not-dark:bg-clip-padding",
          "data-[presentation=dialog]:top-[max(--spacing(4),4vh)] data-[presentation=dialog]:fixed data-[presentation=dialog]:inset-x-0 data-[presentation=dialog]:mx-auto data-[presentation=dialog]:h-[min(40rem,calc(100dvh-2rem))] data-[presentation=dialog]:max-w-[min(36rem,calc(100%-2rem))] data-[presentation=dialog]:rounded-2xl data-[presentation=dialog]:shadow-lg/5 sm:data-[presentation=dialog]:top-[10vh] sm:data-[presentation=dialog]:h-[min(40rem,80dvh)]",
          "data-[presentation=sheet]:h-[calc(var(--visual-viewport-height,100dvh)-3rem)]",
          className
        )}
        data-surface="palette"
        keepMounted={keepMounted}
      >
        <SheetGrip />
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <DialogDescription className="sr-only">{description}</DialogDescription>
        {children}
      </DialogContent>
    </PopupPlace>
  );
}

/** The controller of the palette around a part, which the search field's clear button empties the search through. */
const CommandControllerContext = createContext<CommandController | null>(null);

/**
 * A search field over an always-open list of rows, for the command palette and every picker. It filters its rows as
 * the reader types, unless its caller filters them, as a server search does (`filter={false}`), and it tells a screen
 * reader how many rows are left, in the reader's language. A row runs its `onSelect`, by pointer, keys or an agent
 * alike.
 */
function Command({
  announcement,
  className,
  controller,
  ...props
}: Omit<React.ComponentProps<typeof CommandPrimitive>, "className"> & {
  className?: string | undefined;
}) {
  const t = useTranslations("Common");
  const [own] = useState(createCommandController);
  const control = controller ?? own;
  const announce = (change: ListAnnouncement) => {
    if (change.type !== "results") {
      return null;
    }
    if (change.loading) {
      return t("loading");
    }
    return t("results-count", { count: change.count });
  };

  return (
    <CommandControllerContext value={control}>
      <CommandPrimitive
        announcement={announcement ?? announce}
        className={cn("flex min-h-0 flex-1 flex-col", className)}
        controller={control}
        pendingAnnouncement={t("loading")}
        {...props}
      />
    </CommandControllerContext>
  );
}

/**
 * The search field of a command list, with its search icon and a button that empties it. It does not autofocus: the
 * dialog or the popup around it focuses it when it opens, by its `initialFocus`.
 */
function CommandInput({
  "aria-label": ariaLabel,
  className,
  clearLabel,
  placeholder,
  ...props
}: Omit<React.ComponentProps<typeof CommandInputPrimitive>, "className"> & {
  className?: string | undefined;
  /** The name of the button that empties the search, in the reader's language. */
  clearLabel: string;
  /** What the box shows while empty, which says what to search for. It names the box, unless `aria-label` does. */
  placeholder: string;
}) {
  const controller = use(CommandControllerContext);

  return (
    <div
      className="relative flex shrink-0 items-center px-2.5 py-1.5 has-[input:placeholder-shown]:[--command-clear:hidden]"
      data-slot="command-input-wrapper"
    >
      <HugeIcons
        aria-hidden="true"
        className="text-muted-foreground pointer-events-none absolute start-5.5 opacity-80"
        icon={Search02Icon}
      />
      <CommandInputPrimitive
        aria-label={ariaLabel ?? placeholder}
        className={cn(
          "placeholder:text-muted-foreground h-10 w-full min-w-0 rounded-md bg-transparent ps-9 pe-10 text-base outline-none md:pointer-fine:text-sm [&::-webkit-search-cancel-button]:hidden",
          className
        )}
        enterKeyHint="search"
        placeholder={placeholder}
        type="search"
        {...props}
      />
      <Button
        className="[visibility:var(--command-clear,visible)] absolute end-3"
        onClick={() => {
          controller?.setQuery("");
          controller?.focus();
        }}
        size="icon-sm"
        tooltip={clearLabel}
        type="button"
        variant="ghost"
      >
        <HugeIcons icon={Cancel01Icon} />
      </Button>
    </div>
  );
}

/** The card the rows stand on, ruled off from the search field above it and the keys at its foot. */
function CommandPanel({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "bg-popover relative -mx-px flex min-h-0 flex-1 flex-col overflow-hidden rounded-t-xl border border-b-0 bg-clip-padding shadow-xs/5 not-has-[+[data-slot=command-footer]]:-mb-px not-has-[+[data-slot=command-footer]]:rounded-b-2xl",
        className
      )}
      data-slot="command-panel"
      {...props}
    />
  );
}

/** The rows, which scroll within the panel and fade at the edge that hides more. */
function CommandList({
  className,
  ...props
}: Omit<React.ComponentProps<typeof CommandListPrimitive>, "className"> & {
  className?: string | undefined;
}) {
  return (
    <ScrollArea className="min-h-0 flex-1" scrollFade>
      <CommandListPrimitive
        className={cn("scroll-py-2 p-2 empty:p-0", className)}
        {...props}
      />
    </ScrollArea>
  );
}

/**
 * What the list says when no row matches the search, centred as every empty state is. It stays in the document as the
 * live region that announces it, so it takes room only while it speaks (`data-empty`).
 */
function CommandEmpty({
  className,
  ...props
}: Omit<React.ComponentProps<typeof CommandEmptyPrimitive>, "className"> & {
  className?: string | undefined;
}) {
  return (
    <CommandEmptyPrimitive
      className={cn(
        "text-muted-foreground flex justify-center text-center text-sm data-empty:px-4 data-empty:py-6",
        className
      )}
      {...props}
    />
  );
}

function CommandGroup({
  className,
  ...props
}: Omit<React.ComponentProps<typeof CommandGroupPrimitive>, "className"> & {
  className?: string | undefined;
}) {
  return (
    <CommandGroupPrimitive
      className={cn("[[role=group]+&]:mt-1.5", className)}
      {...props}
    />
  );
}

function CommandGroupLabel({
  className,
  ...props
}: Omit<
  React.ComponentProps<typeof CommandGroupLabelPrimitive>,
  "className"
> & {
  className?: string | undefined;
}) {
  return (
    <CommandGroupLabelPrimitive
      className={cn(
        "text-muted-foreground px-2 py-1.5 text-xs font-medium",
        className
      )}
      {...props}
    />
  );
}

/**
 * One row of a command list. It runs its `onSelect`; a `label` gives the words the search matches when the row's text
 * holds more, or less, than them. A row of the palette stands as tall as a thumb on every screen (`roomy`, the
 * default), and a row of a picker as a select's row does.
 */
function CommandItem({
  className,
  size = "roomy",
  ...props
}: Omit<React.ComponentProps<typeof CommandItemPrimitive>, "className"> &
  Pick<VariantProps<typeof optionRowVariants>, "size"> & {
    className?: string | undefined;
  }) {
  return (
    <CommandItemPrimitive
      className={cn(
        optionRowVariants({ size }),
        "icon-first-line overflow-hidden rounded-md",
        className
      )}
      {...props}
    />
  );
}

function CommandSeparator({
  className,
  ...props
}: Omit<React.ComponentProps<typeof CommandSeparatorPrimitive>, "className"> & {
  className?: string | undefined;
}) {
  return (
    <CommandSeparatorPrimitive
      className={cn("bg-border -mx-2 my-2 h-px", className)}
      {...props}
    />
  );
}

function CommandFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "bg-popover text-muted-foreground flex shrink-0 items-center justify-between gap-2 rounded-b-[calc(var(--radius-2xl)-1px)] border-t px-5 py-3 text-sm",
        className
      )}
      data-slot="command-footer"
      {...props}
    />
  );
}

export {
  Command,
  CommandDialog,
  CommandDialogPopup,
  CommandEmpty,
  CommandFooter,
  CommandGroup,
  CommandGroupLabel,
  CommandInput,
  CommandItem,
  CommandList,
  CommandPanel,
  CommandSeparator,
};
