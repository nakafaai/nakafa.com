import { Menu02Icon } from "@hugeicons/core-free-icons";
import { ButtonGroup } from "@repo/design-system/components/ui/button-group";
import { SidebarTrigger } from "@repo/design-system/components/ui/sidebar-shell";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/design-system/components/ui/tooltip";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { BreadcrumbHeaderFrame } from "@/components/shared/breadcrumb/frame";
import {
  type BreadcrumbHeaderItem,
  BreadcrumbHeaderPath,
} from "@/components/shared/breadcrumb/header";

/** Keeps parent navigation and reading controls together above the content title. */
export async function ContentHeader({
  items,
  children,
}: {
  items: readonly BreadcrumbHeaderItem[];
  children: ReactNode;
}) {
  const t = await getTranslations("Common");
  return (
    <BreadcrumbHeaderFrame>
      <BreadcrumbHeaderPath
        homeLabel={t("home")}
        items={items}
        menuLabel={t("more")}
      />
      <ButtonGroup aria-label={t("content-actions")} className="shrink-0">
        {children}
        <Tooltip>
          <TooltipTrigger
            render={
              <SidebarTrigger
                aria-label={t("on-this-page")}
                className="size-9"
                icon={Menu02Icon}
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
