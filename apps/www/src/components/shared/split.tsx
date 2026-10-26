import { ArrowDown01Icon } from "@hugeicons/core-free-icons";
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
 * The arrow of a split button: the last button of a ButtonGroup, which opens the group's menu and
 * is named More actions for assistive technology and in its tooltip. It renders inside the
 * group's DropdownMenu.
 */
export function SplitMenuTrigger() {
  const common = useTranslations("Common");

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <DropdownMenuTrigger
            render={
              <Button
                aria-label={common("more-actions")}
                size="icon"
                variant="outline"
              />
            }
          >
            <HugeIcons aria-hidden="true" icon={ArrowDown01Icon} />
          </DropdownMenuTrigger>
        }
      />
      <TooltipContent side="bottom">{common("more-actions")}</TooltipContent>
    </Tooltip>
  );
}
