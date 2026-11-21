import { ArrowRight01Icon, Tick01Icon } from "@hugeicons/core-free-icons";
import type { OptionMark } from "@repo/design-system/components/ui/huge-icons";
import {
  HugeIcons,
  OptionIcon,
} from "@repo/design-system/components/ui/huge-icons";
import { SheetGrip } from "@repo/design-system/components/ui/sheet-grip";
import { ButtonGroupVariant } from "@repo/design-system/lib/group";
import {
  optionRowVariants,
  optionTickVariants,
} from "@repo/design-system/lib/option";
import {
  keepClickOnTrigger,
  PopupContainer,
  popupMotion,
  sheetSurface,
} from "@repo/design-system/lib/popup";
import type { NodeChildren } from "@repo/design-system/lib/render";
import type { MenuController } from "@ui-sdk/react/menu";
import {
  createMenuController,
  MenuCheckboxItem,
  MenuContent,
  MenuGroup,
  MenuGroupLabel,
  MenuItem,
  MenuItemIcon,
  MenuItemIndicator,
  Menu as MenuPrimitive,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuSub,
  MenuSubTrigger,
  MenuTrigger,
} from "@ui-sdk/react/menu";
import { cva } from "class-variance-authority";
import { cn } from "cn";
import type * as React from "react";
import { createContext, use, useState, useSyncExternalStore } from "react";
import { useTranslations } from "use-intl";

/**
 * What a row of a menu adds to every option row (`optionRowVariants`): a destructive row reads red and fills red when it
 * is chosen, and a `shortcut` shows its keys on the row's end, muted until the row is chosen.
 */
const menuRowVariants = cva(
  "data-destructive:text-destructive data-destructive:data-highlighted:bg-destructive data-destructive:data-highlighted:text-destructive-foreground **:data-[slot=menu-shortcut]:text-muted-foreground data-highlighted:**:data-[slot=menu-shortcut]:text-accent-foreground whitespace-nowrap **:data-[slot=menu-shortcut]:ms-auto **:data-[slot=menu-shortcut]:ps-4 **:data-[slot=menu-shortcut]:text-xs **:data-[slot=menu-shortcut]:tracking-widest"
);

/**
 * A menu of actions under its trigger. It reads as header, body and footer: its one-word `label`, its main actions,
 * then a separator with Archive and Delete last. Every item shows the icon of its kind. On a phone it rises from the
 * bottom as a sheet, as an iPhone's action sheet does, and on a wide or a mouse screen it opens under its trigger.
 */
function DropdownMenu({
  controller,
  presentation = "auto",
  ...props
}: React.ComponentProps<typeof MenuPrimitive>) {
  const t = useTranslations("Common");
  const [own] = useState<MenuController>(() => createMenuController());
  const shared = controller ?? own;

  return (
    <RootMenu value={{ controller: shared, presentation }}>
      <MenuPrimitive
        container={use(PopupContainer)}
        controller={shared}
        pendingAnnouncement={t("loading")}
        presentation={presentation}
        {...props}
      />
    </RootMenu>
  );
}

/** The menu a submenu stands in: its controller, and how it presents (`presentation`). */
const RootMenu = createContext<{
  controller: MenuController;
  presentation: React.ComponentProps<typeof MenuPrimitive>["presentation"];
} | null>(null);

/**
 * When UI SDK presents a menu of `presentation="auto"` as a sheet: on a phone, a narrow screen with a coarse pointer, as
 * `createPresentation` in `@ui-sdk/core` resolves it as the menu opens.
 */
const PHONE_SHEET = "(max-width: 640px) and (pointer: coarse)";

function subscribePhoneSheet(change: () => void) {
  const query = matchMedia(PHONE_SHEET);
  query.addEventListener("change", change);
  return () => query.removeEventListener("change", change);
}

/** Whether the menu around a submenu stands as a sheet. A server render holds no sheet. */
function useMenuSheet() {
  const root = use(RootMenu);
  const phone = useSyncExternalStore(
    subscribePhoneSheet,
    () => matchMedia(PHONE_SHEET).matches,
    () => false
  );
  return (
    root !== null &&
    (root.presentation === "sheet" || (root.presentation === "auto" && phone))
  );
}

/**
 * Makes the controller that joins a `DropdownMenu` to a `DropdownMenuTrigger` drawn outside it, so a dialog that opens
 * from a menu stands beside the menu and never inside it, and code can open or close the menu by name.
 */
function createDropdownMenuController() {
  return createMenuController();
}

/** The menu's trigger. A click keeps its release on the trigger, so the menu it opened stays open (`keepClickOnTrigger`). */
function DropdownMenuTrigger({
  onPointerDown,
  ...props
}: React.ComponentProps<typeof MenuTrigger>) {
  return (
    <MenuTrigger
      onPointerDown={(event) => {
        keepClickOnTrigger(event);
        onPointerDown?.(event);
      }}
      {...props}
    />
  );
}

/**
 * The menu's popup. It opens with its one-word label, which names what the menu holds, so a menu never opens on
 * items alone: the label is required, and the popup draws it above its items. A menu that sets `keepMounted` stays
 * in the document while closed, hidden, so its items are ready before it opens.
 */
function DropdownMenuContent({
  children,
  className,
  label,
  ...props
}: NodeChildren<React.ComponentProps<typeof MenuContent>> & {
  /** The one word that names what the menu holds, such as "Aksi". */
  label: string;
}) {
  return (
    <ButtonGroupVariant value={undefined}>
      <MenuContent
        className={cn(
          popupMotion(),
          sheetSurface(),
          "bg-popover text-popover-foreground z-50 max-h-(--available-height) w-max max-w-(--available-width) min-w-(--anchor-width) overflow-x-hidden overflow-y-auto overscroll-contain rounded-md border p-1 text-start whitespace-normal shadow-md inset-shadow-[0_-1px_--theme(--color-black/4%)] outline-none not-dark:bg-clip-padding data-[presentation=sheet]:px-2 dark:inset-shadow-[0_1px_--theme(--color-white/6%)] [&:not(:has([role^=menuitem]))]:[--dropdown-menu-nothing:block]",
          className
        )}
        {...props}
      >
        <SheetGrip />
        <MenuGroup>
          <DropdownMenuLabel>{label}</DropdownMenuLabel>
          {children}
        </MenuGroup>
        <DropdownMenuNothing />
      </MenuContent>
    </ButtonGroupVariant>
  );
}

/**
 * The sentence of a menu with no item, so a menu never opens on a thin empty line, however its
 * caller fills it.
 */
function DropdownMenuNothing() {
  const t = useTranslations("Common");

  return (
    <p className="text-muted-foreground [display:var(--dropdown-menu-nothing,none)] max-w-xs px-2 py-1.5 text-sm">
      {t("popup-empty")}
    </p>
  );
}

function DropdownMenuGroup(props: React.ComponentProps<typeof MenuGroup>) {
  return <MenuGroup {...props} />;
}

function DropdownMenuLabel({
  className,
  ...props
}: React.ComponentProps<typeof MenuGroupLabel>) {
  return (
    <MenuGroupLabel
      className={cn(
        "text-muted-foreground px-2 py-1.5 text-xs font-medium",
        className
      )}
      {...props}
    />
  );
}

/** The icon before a row's words. Typeahead and screen readers skip it, as they skip every icon of a menu. */
function DropdownMenuIcon({
  icon,
}: Pick<React.ComponentProps<typeof OptionIcon>, "icon">) {
  return <MenuItemIcon render={<OptionIcon icon={icon} />} />;
}

/** The tick on the end of a switch or a choice that is on. */
function DropdownMenuTick() {
  return (
    <MenuItemIndicator className={optionTickVariants()}>
      <HugeIcons icon={Tick01Icon} />
    </MenuItemIndicator>
  );
}

/**
 * One action of a menu. It shows the icon of its kind before its words, so nothing in a menu is ambiguous. Its action
 * runs from `onSelect`, by pointer, keys or an agent alike; one that returns a Promise keeps the row waiting, and the
 * menu open, until it ends. A `shortcut` such as `"mod+k"` shows the keys of the platform on the row's end.
 */
function DropdownMenuItem({
  children,
  className,
  icon,
  variant = "default",
  ...props
}: NodeChildren<React.ComponentProps<typeof MenuItem>> &
  Pick<React.ComponentProps<typeof OptionIcon>, "icon"> & {
    variant?: "default" | "destructive";
  }) {
  return (
    <MenuItem
      className={cn(optionRowVariants(), menuRowVariants(), className)}
      destructive={variant === "destructive"}
      {...props}
    >
      <DropdownMenuIcon icon={icon} />
      {children}
    </MenuItem>
  );
}

/** The controller of the submenu a `DropdownMenuSubTrigger` opens. */
const SubmenuController = createContext<MenuController | null>(null);

/**
 * A submenu that a phone's sheet stacks as a sheet of its own: its controller, the options of its menu, and how to
 * close the menu it stands on.
 */
const StackedSubmenu = createContext<{
  closeMenu: () => void;
  controller: MenuController;
  options: Omit<
    React.ComponentProps<typeof MenuSub>,
    "children" | "controller"
  >;
} | null>(null);

/**
 * A submenu. Beside its menu, its trigger takes Escape while the submenu stands open over it, as it does once a pointer
 * opened it and left the focus on the trigger, and closes only the submenu, as every open layer leaves to the one above
 * it. UI SDK 0.1.0-beta.13 closes the whole menu there (https://github.com/vercel-labs/ui/issues/1006).
 *
 * On a phone the submenu rises as a sheet of its own over its menu's sheet, which steps back in view behind it; a swipe
 * down returns to the menu. UI SDK would draw it inside the menu's sheet with the menu's other rows hidden, so there it
 * is a menu of its own, opened by its trigger row through a controller. The row stays in the menu's sheet, so the new
 * sheet stacks on the menu's layer. A choice that closes the submenu closes the menu too, as it does beside the menu.
 */
function DropdownMenuSub({
  children,
  controller,
  ...options
}: React.ComponentProps<typeof MenuSub>) {
  const [own] = useState<MenuController>(() => createMenuController());
  const shared = controller ?? own;
  const root = use(RootMenu);
  const sheet = useMenuSheet();

  if (sheet && root !== null) {
    return (
      <StackedSubmenu
        value={{
          closeMenu: () => root.controller.close({ reason: "item-press" }),
          controller: shared,
          options,
        }}
      >
        {children}
      </StackedSubmenu>
    );
  }
  return (
    <SubmenuController value={shared}>
      <MenuSub controller={shared} {...options}>
        {children}
      </MenuSub>
    </SubmenuController>
  );
}

/** What a submenu's trigger row shows: the icon of its kind, its words, and the arrow toward the submenu. */
function SubTriggerRow({
  children,
  icon,
}: { children: React.ReactNode } & Pick<
  React.ComponentProps<typeof OptionIcon>,
  "icon"
>) {
  return (
    <>
      <DropdownMenuIcon icon={icon} />
      {children}
      <HugeIcons
        className="ml-auto opacity-80 rtl:rotate-180"
        icon={ArrowRight01Icon}
      />
    </>
  );
}

/** Opens a submenu. Like every option it shows the icon of its kind before its words. */
function DropdownMenuSubTrigger({
  className,
  icon,
  children,
  onKeyDown,
  ...props
}: Omit<
  NodeChildren<React.ComponentProps<typeof MenuSubTrigger>>,
  "render" | "style"
> &
  Pick<React.ComponentProps<typeof OptionIcon>, "icon">) {
  const submenu = use(SubmenuController);
  const stacked = use(StackedSubmenu);
  const rowClassName = cn(
    optionRowVariants(),
    menuRowVariants(),
    "data-open:bg-accent data-open:text-accent-foreground",
    className
  );

  if (stacked !== null) {
    // A row of the menu, which keeps the menu open, and the trigger of the submenu's own sheet.
    return (
      <MenuItem
        className={rowClassName}
        closeOnSelect={false}
        onKeyDown={onKeyDown}
        render={<MenuTrigger controller={stacked.controller} />}
        {...props}
      >
        <SubTriggerRow icon={icon}>{children}</SubTriggerRow>
      </MenuItem>
    );
  }
  return (
    <MenuSubTrigger
      className={rowClassName}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (event.key !== "Escape" || submenu === null || !submenu.isOpen()) {
          return;
        }
        // The menu around the trigger would take this Escape and close itself.
        event.preventDefault();
        event.stopPropagation();
        submenu.close({ reason: "escape-key" });
      }}
      {...props}
    >
      <SubTriggerRow icon={icon}>{children}</SubTriggerRow>
    </MenuSubTrigger>
  );
}

/**
 * A submenu's popup, beside its trigger, or on a phone a sheet of its own over its menu's sheet. Both are a menu's popup,
 * with its own label.
 */
function DropdownMenuSubContent({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuContent>) {
  const stacked = use(StackedSubmenu);

  if (stacked === null) {
    return (
      <DropdownMenuContent className={cn("min-w-24", className)} {...props} />
    );
  }
  return (
    <DropdownMenu
      {...stacked.options}
      controller={stacked.controller}
      onOpenChange={(open, details) => {
        stacked.options.onOpenChange?.(open, details);
        if (!open && details.reason === "item-press") {
          stacked.closeMenu();
        }
      }}
      presentation="sheet"
    >
      <DropdownMenuContent className={cn("min-w-24", className)} {...props} />
    </DropdownMenu>
  );
}

/** One switch of a menu, shown with the icon of its kind before its words. It keeps the menu open as it turns. */
function DropdownMenuCheckboxItem({
  className,
  children,
  icon,
  ...props
}: NodeChildren<React.ComponentProps<typeof MenuCheckboxItem>> &
  Pick<React.ComponentProps<typeof OptionIcon>, "icon">) {
  return (
    <MenuCheckboxItem
      className={cn(
        optionRowVariants({ mark: "tick" }),
        menuRowVariants(),
        className
      )}
      {...props}
    >
      <DropdownMenuTick />
      <DropdownMenuIcon icon={icon} />
      {children}
    </MenuCheckboxItem>
  );
}

function DropdownMenuRadioGroup<T extends string = string>(
  props: React.ComponentProps<typeof MenuRadioGroup<T>>
) {
  return <MenuRadioGroup<T> {...props} />;
}

/**
 * One choice of a radio group in a menu, shown with the icon of its kind before its words. A radio item picks one
 * value, as a select does, so the menu closes once a value is chosen; a menu that switches values in place passes
 * `closeOnSelect={false}`.
 */
function DropdownMenuRadioItem({
  className,
  children,
  closeOnSelect = true,
  icon,
  plain,
  ...props
}: NodeChildren<React.ComponentProps<typeof MenuRadioItem>> & OptionMark) {
  return (
    <MenuRadioItem
      className={cn(
        optionRowVariants({ mark: "tick" }),
        menuRowVariants(),
        className
      )}
      closeOnSelect={closeOnSelect}
      {...props}
    >
      <DropdownMenuTick />
      {plain ? null : <DropdownMenuIcon icon={icon} />}
      {children}
    </MenuRadioItem>
  );
}

function DropdownMenuSeparator({
  className,
  ...props
}: React.ComponentProps<typeof MenuSeparator>) {
  return (
    <MenuSeparator
      className={cn("bg-border -mx-1 my-1 h-px", className)}
      {...props}
    />
  );
}

export {
  createDropdownMenuController,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
};
