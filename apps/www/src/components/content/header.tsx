import { Menu02Icon } from "@hugeicons/core-free-icons";
import { ButtonGroup } from "@repo/design-system/components/ui/button-group";
import type { ReactNode } from "react";
import { useTranslations } from "use-intl";
import { BreadcrumbHeaderFrame } from "@/components/shared/breadcrumb/frame";
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
    <BreadcrumbHeaderFrame contentClassName="@container">
      {title === undefined ? null : <h1 className="sr-only">{title}</h1>}
      <div className="min-w-0">{breadcrumb}</div>
      <div className="flex shrink-0 items-center gap-2">
        <ButtonGroup aria-label={t("content-actions")}>{children}</ButtonGroup>
        <PanelSheetTrigger icon={Menu02Icon} label={t("on-this-page")} />
      </div>
    </BreadcrumbHeaderFrame>
  );
}
