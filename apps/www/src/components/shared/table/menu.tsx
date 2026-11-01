import { Copy01Icon, MoreHorizontalIcon } from "@hugeicons/core-free-icons";
import { useClipboard } from "@mantine/hooks";
import { Button } from "@repo/design-system/components/ui/button";
import {
  createDropdownMenuHandle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  type ComponentProps,
  createContext,
  type ReactNode,
  use,
  useRef,
  useState,
} from "react";
import { useTranslations } from "use-intl";

/** A row's menu, as `RowMenu` shares it with what its cell holds. */
const RowMenuContext = createContext<{
  /** The handle that joins the row's three-dot button to its items. */
  readonly handle: ReturnType<typeof createDropdownMenuHandle>;
  /** Presses the row, as pressing its first column does. */
  readonly press: () => void;
} | null>(null);

/** Reads the menu of the row around a cell. */
function useRowMenu() {
  const menu = use(RowMenuContext);
  if (menu === null) {
    // Items outside their row's menu are a composition error at this seam.
    throw new Error("Row items render inside a table's menu column.");
  }
  return menu;
}

/**
 * The one action of a table's row: the ghost three-dot button, which `DataTable` draws around the menu column's cell, so
 * no table draws a button of its own. The cell gives what the menu holds through `RowItems`. Its dialogs stand beside the
 * menu and never inside it, because a menu opened from a dialog must not take the row's menu for its parent, so the
 * button and the menu meet through a handle.
 */
export function RowMenu({
  children,
  inert,
}: {
  children: ReactNode;
  /** Whether the button does not answer yet, such as on a row the server has not confirmed. */
  inert: boolean | undefined;
}) {
  const common = useTranslations("Common");
  const [handle] = useState(() => createDropdownMenuHandle());
  const trigger = useRef<HTMLButtonElement>(null);

  return (
    <RowMenuContext
      value={{ handle, press: () => trigger.current?.closest("tr")?.click() }}
    >
      <div className="flex justify-end">
        <DropdownMenuTrigger
          handle={handle}
          ref={trigger}
          render={
            <Button
              aria-label={common("more-actions")}
              inert={inert}
              size="icon-sm"
              variant="ghost"
            >
              <HugeIcons icon={MoreHorizontalIcon} />
            </Button>
          }
        />
      </div>
      {children}
    </RowMenuContext>
  );
}

/** What a row's menu holds under its label, which every row's menu shares. */
export function RowItems({
  children,
  onOpenChange,
}: {
  children: ReactNode;
  /** Tells a row's dialog that its menu opened, so what the dialog reads is ready before it opens. */
  onOpenChange?: ComponentProps<typeof DropdownMenu>["onOpenChange"];
}) {
  const common = useTranslations("Common");
  const { handle } = useRowMenu();

  return (
    <DropdownMenu handle={handle} onOpenChange={onOpenChange}>
      <DropdownMenuContent align="end" className="min-w-48">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{common("menu-actions")}</DropdownMenuLabel>
          {children}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** The item that opens a row as pressing it does, for a row that opens something. */
export function RowOpen({
  icon,
  label,
}: {
  icon: ComponentProps<typeof HugeIcons>["icon"];
  label: string;
}) {
  const { press } = useRowMenu();

  return (
    <DropdownMenuItem onClick={press}>
      <HugeIcons icon={icon} />
      {label}
    </DropdownMenuItem>
  );
}

/** What a row offers a reader who may do nothing else with it: its text, to copy. */
export function RowCopy({ value }: { value: string }) {
  const common = useTranslations("Common");
  const clipboard = useClipboard();

  return (
    <RowItems>
      <DropdownMenuItem onClick={() => clipboard.copy(value)}>
        <HugeIcons icon={Copy01Icon} />
        {common("copy")}
      </DropdownMenuItem>
    </RowItems>
  );
}
