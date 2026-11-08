import { Button } from "@repo/design-system/components/ui/button";
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@repo/design-system/components/ui/dropdown-menu";
import type { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { type ComponentProps, type ReactNode, useState } from "react";
import { RowItems } from "@/components/shared/table/menu";

/**
 * What the menu of one table row holds when its last action is destructive: the row's main actions, a separator, then the
 * menu's footer, an archive action where the row has one and the destructive action last with its icon. The action opens
 * a confirmation whose body shows what it loses, and `onConfirm` runs only once the viewer confirms it, so nothing is
 * removed by a single click. A row that may not take the action now keeps it in view, disabled (`disabled`); a row the
 * server would refuse leaves it out (`offered`), so the menu never offers what fails.
 */
export function ConfirmRowMenu({
  action,
  body,
  children,
  confirm,
  description,
  disabled = false,
  footer,
  icon,
  offered = true,
  onConfirm,
  title,
}: {
  readonly action: string;
  /**
   * What the confirmation shows the action loses, such as the record it deletes: the dialog's body, which every
   * dialog has, usually a ResponsiveDialogSubject with the row's name.
   */
  readonly body: ReactNode;
  /** The row's main actions, above the separator. */
  readonly children?: ReactNode;
  readonly confirm: string;
  readonly description: string;
  /** Whether this row may not take the destructive action now. */
  readonly disabled?: boolean;
  /** The footer's action before the destructive one, such as Archive. */
  readonly footer?: ReactNode;
  readonly icon: ComponentProps<typeof HugeIcons>["icon"];
  /** Whether the menu offers the destructive action at all, as the server would take it. */
  readonly offered?: boolean;
  readonly onConfirm: () => void;
  readonly title: string;
}) {
  const [isConfirming, setIsConfirming] = useState(false);
  const hasFooter = footer !== undefined || offered;

  return (
    <>
      <RowItems>
        {children}
        {children !== undefined && hasFooter ? <DropdownMenuSeparator /> : null}
        {footer}
        {offered ? (
          <DropdownMenuItem
            disabled={disabled}
            icon={icon}
            onClick={() => setIsConfirming(true)}
            variant="destructive"
          >
            {action}
          </DropdownMenuItem>
        ) : null}
      </RowItems>
      {offered ? (
        <ResponsiveDialog
          action={
            <Button
              onClick={() => {
                setIsConfirming(false);
                onConfirm();
              }}
              type="button"
              variant="destructive"
            >
              {confirm}
            </Button>
          }
          description={description}
          open={isConfirming}
          setOpen={setIsConfirming}
          title={title}
        >
          {body}
        </ResponsiveDialog>
      ) : null}
    </>
  );
}
