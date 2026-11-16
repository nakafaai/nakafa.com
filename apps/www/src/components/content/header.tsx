import { Menu02Icon } from "@hugeicons/core-free-icons";
import { ButtonGroup } from "@repo/design-system/components/ui/button-group";
import type { ReactNode } from "react";
import { useTranslations } from "use-intl";
import { PageActions, PageHeader } from "@/components/shared/page/header";
import { PanelSheetTrigger } from "@/components/sidebar/sheet";

/**
 * The header of a reading page: the path to the page's parent and the reading controls. It draws no heading, because
 * the page's title opens its body (`ContentTitle`), as every reading page's does, so a path ends at the parent and
 * never names the page.
 */
export function ContentHeader({
  breadcrumb,
  children,
}: {
  breadcrumb: ReactNode;
  children: ReactNode;
}) {
  const t = useTranslations("Common");
  return (
    <PageHeader>
      <div className="min-w-0">{breadcrumb}</div>
      <PageActions>
        <ButtonGroup aria-label={t("content-actions")}>{children}</ButtonGroup>
        <PanelSheetTrigger icon={Menu02Icon} label={t("on-this-page")} />
      </PageActions>
    </PageHeader>
  );
}
