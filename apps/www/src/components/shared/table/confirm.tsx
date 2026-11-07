import { Button } from "@repo/design-system/components/ui/button";
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { type ComponentProps, type ReactNode, useState } from "react";
import { useTranslations } from "use-intl";
import { RowItems } from "@/components/shared/table/menu";

/**
 * What the menu of one table row holds when its last action is destructive: the row's main actions, a separator, then the
 * menu's footer, an archive action where the row has one and the destructive action last with its icon. The action opens
 * a confirmation whose body shows what it loses, and `onConfirm` runs only once the viewer confirms it, so nothing is
 * removed by a single click. A row that may not take the action keeps it in view, disabled, so every row's menu reads the
 * same.
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
  onConfirm,
  title,
}: {
  readonly action: string;
  /** What the confirmation shows the action loses, such as the record it deletes. */
  readonly body?: ReactNode;
  /** The row's main actions, above the separator. */
  readonly children?: ReactNode;
  readonly confirm: string;
  readonly description: string;
  /** Whether this row may not take the destructive action. */
  readonly disabled?: boolean;
  /** The footer's action before the destructive one, such as Archive. */
  readonly footer?: ReactNode;
  readonly icon: ComponentProps<typeof HugeIcons>["icon"];
  readonly onConfirm: () => void;
  readonly title: string;
}) {
  const common = useTranslations("Common");
  const [isConfirming, setIsConfirming] = useState(false);

  return (
    <>
      <RowItems>
        {children}
        {children === undefined ? null : <DropdownMenuSeparator />}
        {footer}
        <DropdownMenuItem
          disabled={disabled}
          onClick={() => setIsConfirming(true)}
          variant="destructive"
        >
          <HugeIcons icon={icon} />
          {action}
        </DropdownMenuItem>
      </RowItems>
      <ResponsiveDialog
        description={description}
        footer={
          <>
            <Button
              onClick={() => setIsConfirming(false)}
              type="button"
              variant="outline"
            >
              {common("cancel")}
            </Button>
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
          </>
        }
        open={isConfirming}
        setOpen={setIsConfirming}
        title={title}
      >
        {body}
      </ResponsiveDialog>
    </>
  );
}
