import { MoreHorizontalIcon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { type ComponentProps, useState } from "react";
import { useTranslations } from "use-intl";

/**
 * The menu of one table row whose only action is destructive, with the action's icon. The action opens a
 * confirmation, and `onConfirm` runs only once the viewer confirms it, so nothing is removed by a single click.
 */
export function ConfirmRowMenu({
  action,
  confirm,
  description,
  icon,
  onConfirm,
  title,
}: {
  readonly action: string;
  readonly confirm: string;
  readonly description: string;
  readonly icon: ComponentProps<typeof HugeIcons>["icon"];
  readonly onConfirm: () => void;
  readonly title: string;
}) {
  const common = useTranslations("Common");
  const [isConfirming, setIsConfirming] = useState(false);

  return (
    <div className="flex justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              aria-label={common("more-actions")}
              size="icon-sm"
              variant="ghost"
            >
              <HugeIcons icon={MoreHorizontalIcon} />
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem
            onClick={() => setIsConfirming(true)}
            variant="destructive"
          >
            <HugeIcons icon={icon} />
            {action}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
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
    </div>
  );
}
