import { Menu02Icon } from "@hugeicons/core-free-icons";
import { ButtonGroup } from "@repo/design-system/components/ui/button-group";
import type { ReactNode } from "react";
import { useTranslations } from "use-intl";
import { BreadcrumbHeaderFrame } from "@/components/shared/breadcrumb/frame";
import { PanelSheetTrigger } from "@/components/sidebar/sheet";

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
      <div className="flex shrink-0 items-center gap-2">
        <ButtonGroup aria-label={t("content-actions")}>{children}</ButtonGroup>
        <PanelSheetTrigger icon={Menu02Icon} label={t("on-this-page")} />
      </div>
    </BreadcrumbHeaderFrame>
  );
}
