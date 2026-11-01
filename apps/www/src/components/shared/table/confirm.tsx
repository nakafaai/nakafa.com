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
 * What the menu of one table row holds when its last action is destructive: the action with its icon, below the row's other
 * actions when it has any. The action opens a confirmation, and `onConfirm` runs only once the viewer confirms it, so nothing
 * is removed by a single click. A row that may not take the action keeps it in view, disabled, so every row's menu
 * reads the same.
 */
export function ConfirmRowMenu({
  action,
  children,
  confirm,
  description,
  disabled = false,
  icon,
  onConfirm,
  title,
}: {
  readonly action: string;
  /** The row's other actions, above the destructive one. */
  readonly children?: ReactNode;
  readonly confirm: string;
  readonly description: string;
  /** Whether this row may not take the destructive action. */
  readonly disabled?: boolean;
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
      />
    </>
  );
}
