import { Menu02Icon } from "@hugeicons/core-free-icons";
import { ButtonGroup } from "@repo/design-system/components/ui/button-group";
import { SidebarTrigger } from "@repo/design-system/components/ui/sidebar-shell";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/design-system/components/ui/tooltip";
import type { ReactNode } from "react";
import { useTranslations } from "use-intl";
import { BreadcrumbHeaderFrame } from "@/components/shared/breadcrumb/frame";

/** Keeps parent navigation and reading controls together above the content title. */
export function ContentHeader({
  breadcrumb,
  children,
}: {
  breadcrumb: ReactNode;
  children: ReactNode;
}) {
  const t = useTranslations("Common");
  return (
    <BreadcrumbHeaderFrame>
      <div className="min-w-0">{breadcrumb}</div>
      <ButtonGroup aria-label={t("content-actions")} className="shrink-0">
        {children}
        <Tooltip>
          <TooltipTrigger
            render={
              <SidebarTrigger
                className="size-9"
                icon={Menu02Icon}
                label={t("on-this-page")}
                size="icon"
                variant="outline"
              />
            }
          />
          <TooltipContent side="bottom">{t("on-this-page")}</TooltipContent>
        </Tooltip>
      </ButtonGroup>
    </BreadcrumbHeaderFrame>
  );
}
