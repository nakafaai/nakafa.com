import {
  ArrowDown01Icon,
  IdentityCardIcon,
  Refresh01Icon,
  UserSwitchIcon,
} from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { ButtonGroup } from "@repo/design-system/components/ui/button-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/design-system/components/ui/tooltip";
import { useRouter } from "@tanstack/react-router";
import { useTransition } from "react";
import { useTranslations } from "use-intl";

/** The ways in that leave the signed-in account: another account, or a school card. */
export type OutsiderWay = "card" | "switch";

/**
 * The ways into a school for a signed-in visitor who is not a member of it. Sign in with a card is
 * the main action, with a menu that checks for the invite again, because an invite that an admin
 * just sent may take a moment to appear; Switch account stands beside it as the one secondary. Both
 * ways that leave the account go through `onLeave`, which shows the sign-in at once; a card is
 * redeemed only from a signed-out device, so that way signs out too.
 */
export function TenantOutsiderActions({
  onLeave,
}: {
  onLeave: (way: OutsiderWay) => void;
}) {
  const t = useTranslations("SchoolEntry");
  const common = useTranslations("Common");
  const router = useRouter();
  const [isChecking, startChecking] = useTransition();

  return (
    <div className="flex flex-wrap justify-center gap-2">
      <ButtonGroup>
        <Button onClick={() => onLeave("card")}>
          <HugeIcons aria-hidden="true" icon={IdentityCardIcon} />
          {t("outsider-card")}
        </Button>
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger
              render={
                <DropdownMenuTrigger
                  render={
                    <Button
                      aria-busy={isChecking || undefined}
                      aria-label={common("more-actions")}
                      size="icon"
                    />
                  }
                >
                  <Spinner icon={ArrowDown01Icon} isLoading={isChecking} />
                </DropdownMenuTrigger>
              }
            />
            <TooltipContent side="bottom">
              {common("more-actions")}
            </TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuItem
              className="cursor-pointer"
              onClick={() => startChecking(() => router.invalidate())}
            >
              <HugeIcons icon={Refresh01Icon} />
              {t("outsider-check-again")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </ButtonGroup>
      <Button onClick={() => onLeave("switch")} variant="outline">
        <HugeIcons aria-hidden="true" icon={UserSwitchIcon} />
        {t("outsider-switch")}
      </Button>
    </div>
  );
}
