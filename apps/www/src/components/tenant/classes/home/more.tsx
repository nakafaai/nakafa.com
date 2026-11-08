import { MoreHorizontalIcon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { DropdownMenuTrigger } from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/design-system/components/ui/tooltip";
import { useTranslations } from "use-intl";

/**
 * The ghost three-dot button that opens the menu of an announcement or a kept one, which shows only its icon, so its
 * name stands in its tooltip.
 */
export function PostMenuTrigger() {
  const common = useTranslations("Common");

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <DropdownMenuTrigger
            render={
              <Button
                size="icon-sm"
                tooltip={common("more-actions")}
                variant="ghost"
              />
            }
          />
        }
      >
        <HugeIcons icon={MoreHorizontalIcon} />
      </TooltipTrigger>
      <TooltipContent side="bottom">{common("more-actions")}</TooltipContent>
    </Tooltip>
  );
}
