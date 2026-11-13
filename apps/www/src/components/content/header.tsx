import { Menu02Icon } from "@hugeicons/core-free-icons";
import { ButtonGroup } from "@repo/design-system/components/ui/button-group";
import type { ReactNode } from "react";
import { useTranslations } from "use-intl";
import { PageActions, PageHeader } from "@/components/shared/page/header";
import { PanelSheetTrigger } from "@/components/sidebar/sheet";

/**
 * Keeps parent navigation and reading controls together above the content. A page
 * whose path names it, such as an article, gives its `title`, which stands as the
 * page's heading for assistive technology, as every breadcrumb header's does.
 */
export function ContentHeader({
  breadcrumb,
  children,
  title,
}: {
  breadcrumb: ReactNode;
  children: ReactNode;
  title?: string;
}) {
  const t = useTranslations("Common");
  return (
    <PageHeader {...(title === undefined ? {} : { title })}>
      <div className="min-w-0">{breadcrumb}</div>
      <PageActions>
        <ButtonGroup aria-label={t("content-actions")}>{children}</ButtonGroup>
        <PanelSheetTrigger icon={Menu02Icon} label={t("on-this-page")} />
      </PageActions>
    </PageHeader>
  );
}
