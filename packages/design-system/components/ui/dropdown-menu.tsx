import { Menu as MenuPrimitive } from "@base-ui/react/menu";
import { ArrowRight01Icon, Tick01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { OptionIcon } from "@repo/design-system/components/ui/huge-icons";
import { ButtonGroupVariant } from "@repo/design-system/lib/group";
import { PortalContainer } from "@repo/design-system/lib/portal";
import { cn } from "cn";
import type * as React from "react";
import { use } from "react";
import { useTranslations } from "use-intl";

function DropdownMenu({ ...props }: MenuPrimitive.Root.Props) {
  return <MenuPrimitive.Root data-slot="dropdown-menu" {...props} />;
}

function DropdownMenuPortal({ ...props }: MenuPrimitive.Portal.Props) {
  return <MenuPrimitive.Portal data-slot="dropdown-menu-portal" {...props} />;
}

function DropdownMenuTrigger({ ...props }: MenuPrimitive.Trigger.Props) {
  return <MenuPrimitive.Trigger data-slot="dropdown-menu-trigger" {...props} />;
}

/**
 * Makes the handle that joins a `DropdownMenu` to a `DropdownMenuTrigger` drawn outside it, so a
 * dialog that opens from a menu stands beside the menu and never inside it.
 */
const createDropdownMenuHandle = MenuPrimitive.createHandle;

/**
 * Renders the positioned menu popup. It opens with its one-word label, which names what the menu holds, so a menu
 * never opens on items alone: the label is required, and the popup draws it above its items. A menu that sets
 * `keepMounted` stays in the document while closed, hidden, so its items are ready before it opens.
 */
function DropdownMenuContent({
  align = "start",
  alignOffset = 0,
  keepMounted = false,
  side = "bottom",
  sideOffset = 4,
  children,
  className,
  label,
  ...props
}: MenuPrimitive.Popup.Props &
  Pick<
    MenuPrimitive.Positioner.Props,
    "align" | "alignOffset" | "side" | "sideOffset"
  > & {
    keepMounted?: boolean;
    /** The one word that names what the menu holds, such as "Aksi". */
    label: string;
  }) {
  return (
    <ButtonGroupVariant value={undefined}>
      <MenuPrimitive.Portal
        container={use(PortalContainer)}
        keepMounted={keepMounted}
      >
        {/* Fixed to the screen, so a page that scrolls under an open menu never pulls it off its trigger, which
            mostly stands in a sticky header. */}
        <MenuPrimitive.Positioner
          align={align}
          alignOffset={alignOffset}
          className="isolate z-50 outline-none"
          positionMethod="fixed"
          side={side}
          sideOffset={sideOffset}
        >
          <MenuPrimitive.Popup
            className={cn(
              "data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:fade-in-0 data-open:zoom-in-95 data-closed:fade-out-0 data-closed:zoom-out-95 bg-popover text-popover-foreground duration-ui motion-safe:data-closed:animate-out motion-safe:data-open:animate-in z-50 max-h-(--available-height) w-max max-w-(--available-width) min-w-(--anchor-width) origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-md border p-1 shadow-md inset-shadow-[0_-1px_--theme(--color-black/4%)] ease-out outline-none not-dark:bg-clip-padding data-closed:overflow-hidden dark:inset-shadow-[0_1px_--theme(--color-white/6%)] [&:not(:has([role^=menuitem]))]:[--dropdown-menu-nothing:block]",
              className
            )}
            data-slot="dropdown-menu-content"
            {...props}
          >
            <MenuPrimitive.Group data-slot="dropdown-menu-group">
              <DropdownMenuLabel>{label}</DropdownMenuLabel>
              {children}
            </MenuPrimitive.Group>
            <DropdownMenuNothing />
          </MenuPrimitive.Popup>
        </MenuPrimitive.Positioner>
      </MenuPrimitive.Portal>
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

function DropdownMenuGroup({ ...props }: MenuPrimitive.Group.Props) {
  return <MenuPrimitive.Group data-slot="dropdown-menu-group" {...props} />;
}

function DropdownMenuLabel({
  className,
  inset,
  ...props
}: MenuPrimitive.GroupLabel.Props & {
  inset?: boolean;
}) {
  return (
    <MenuPrimitive.GroupLabel
      className={cn(
        "text-muted-foreground px-2 py-1.5 text-xs font-medium data-inset:pl-8",
        className
      )}
      data-inset={inset}
      data-slot="dropdown-menu-label"
      {...props}
    />
  );
}

/** One action of a menu. It shows the icon of its kind before its words, so nothing in a menu is ambiguous. */
function DropdownMenuItem({
  children,
  className,
  icon,
  inset,
  variant = "default",
  ...props
}: MenuPrimitive.Item.Props &
  Pick<React.ComponentProps<typeof OptionIcon>, "icon"> & {
    inset?: boolean;
    variant?: "default" | "destructive";
  }) {
  return (
    <MenuPrimitive.Item
      className={cn(
        "group/dropdown-menu-item focus:bg-accent focus:text-accent-foreground not-data-[variant=destructive]:focus:**:text-accent-foreground data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-destructive data-[variant=destructive]:focus:text-destructive-foreground data-[variant=destructive]:focus:**:text-destructive-foreground relative flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm whitespace-nowrap outline-hidden select-none data-disabled:pointer-events-none data-disabled:opacity-50 data-inset:pl-8 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='opacity-'])]:opacity-80 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      data-inset={inset}
      data-slot="dropdown-menu-item"
      data-variant={variant}
      {...props}
    >
      <OptionIcon icon={icon} />
      {children}
    </MenuPrimitive.Item>
  );
}

function DropdownMenuSub({ ...props }: MenuPrimitive.SubmenuRoot.Props) {
  return <MenuPrimitive.SubmenuRoot data-slot="dropdown-menu-sub" {...props} />;
}

/** Opens a submenu. Like every option it shows the icon of its kind before its words. */
function DropdownMenuSubTrigger({
  className,
  icon,
  inset,
  children,
  ...props
}: MenuPrimitive.SubmenuTrigger.Props &
  Pick<React.ComponentProps<typeof OptionIcon>, "icon"> & {
    inset?: boolean;
  }) {
  return (
    <MenuPrimitive.SubmenuTrigger
      className={cn(
        "focus:bg-accent focus:text-accent-foreground not-data-[variant=destructive]:focus:**:text-accent-foreground data-open:bg-accent data-popup-open:bg-accent data-open:text-accent-foreground data-popup-open:text-accent-foreground flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm whitespace-nowrap outline-hidden select-none data-inset:pl-8 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      data-inset={inset}
      data-slot="dropdown-menu-sub-trigger"
      {...props}
    >
      <OptionIcon icon={icon} />
      {children}
      <HugeiconsIcon className="ml-auto opacity-80" icon={ArrowRight01Icon} />
    </MenuPrimitive.SubmenuTrigger>
  );
}

function DropdownMenuSubContent({
  align = "start",
  alignOffset = -3,
  side = "right",
  sideOffset = 0,
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuContent>) {
  return (
    <DropdownMenuContent
      align={align}
      alignOffset={alignOffset}
      className={cn("w-auto min-w-24", className)}
      data-slot="dropdown-menu-sub-content"
      side={side}
      sideOffset={sideOffset}
      {...props}
    />
  );
}

/** One switch of a menu, shown with the icon of its kind before its words. */
function DropdownMenuCheckboxItem({
  className,
  children,
  checked,
  icon,
  inset,
  ...props
}: MenuPrimitive.CheckboxItem.Props &
  Pick<React.ComponentProps<typeof OptionIcon>, "icon"> & {
    inset?: boolean;
  }) {
  return (
    <MenuPrimitive.CheckboxItem
      checked={checked}
      className={cn(
        "focus:bg-accent focus:text-accent-foreground focus:**:text-accent-foreground relative flex items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm whitespace-nowrap outline-hidden select-none data-disabled:pointer-events-none data-disabled:opacity-50 data-inset:pl-8 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      data-inset={inset}
      data-slot="dropdown-menu-checkbox-item"
      {...props}
    >
      <span
        className="pointer-events-none absolute right-2 flex items-center justify-center"
        data-slot="dropdown-menu-checkbox-item-indicator"
      >
        <MenuPrimitive.CheckboxItemIndicator>
          <HugeiconsIcon icon={Tick01Icon} />
        </MenuPrimitive.CheckboxItemIndicator>
      </span>
      <OptionIcon icon={icon} />
      {children}
    </MenuPrimitive.CheckboxItem>
  );
}

function DropdownMenuRadioGroup({ ...props }: MenuPrimitive.RadioGroup.Props) {
  return (
    <MenuPrimitive.RadioGroup
      data-slot="dropdown-menu-radio-group"
      {...props}
    />
  );
}

/**
 * One choice of a radio group in a menu, shown with the icon of its kind before its words. A radio item picks one
 * value, as a select does, so the menu closes once a value is chosen, where Base UI keeps it open; a menu that
 * switches values in place passes `closeOnClick={false}`.
 */
function DropdownMenuRadioItem({
  className,
  children,
  closeOnClick = true,
  icon,
  inset,
  ...props
}: MenuPrimitive.RadioItem.Props &
  Pick<React.ComponentProps<typeof OptionIcon>, "icon"> & {
    inset?: boolean;
  }) {
  return (
    <MenuPrimitive.RadioItem
      className={cn(
        "focus:bg-accent focus:text-accent-foreground focus:**:text-accent-foreground relative flex items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm whitespace-nowrap outline-hidden select-none data-disabled:pointer-events-none data-disabled:opacity-50 data-inset:pl-8 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      closeOnClick={closeOnClick}
      data-inset={inset}
      data-slot="dropdown-menu-radio-item"
      {...props}
    >
      <span
        className="pointer-events-none absolute right-2 flex items-center justify-center"
        data-slot="dropdown-menu-radio-item-indicator"
      >
        <MenuPrimitive.RadioItemIndicator>
          <HugeiconsIcon icon={Tick01Icon} />
        </MenuPrimitive.RadioItemIndicator>
      </span>
      <OptionIcon icon={icon} />
      {children}
    </MenuPrimitive.RadioItem>
  );
}

function DropdownMenuSeparator({
  className,
  ...props
}: MenuPrimitive.Separator.Props) {
  return (
    <MenuPrimitive.Separator
      className={cn("bg-border -mx-1 my-1 h-px", className)}
      data-slot="dropdown-menu-separator"
      {...props}
    />
  );
}

function DropdownMenuShortcut({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "text-muted-foreground group-focus/dropdown-menu-item:text-accent-foreground ml-auto text-xs tracking-widest",
        className
      )}
      data-slot="dropdown-menu-shortcut"
      {...props}
    />
  );
}

export {
  createDropdownMenuHandle,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
};
