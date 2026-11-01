import { MoreHorizontalIcon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import type { ReactNode } from "react";
import { useTranslations } from "use-intl";

/** The three-dot button at the end of a table row, and the menu of what the row can do. */
export function RowMenu({ children }: { children: ReactNode }) {
  const common = useTranslations("Common");

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
        <DropdownMenuContent align="end" className="w-48">
          {children}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
