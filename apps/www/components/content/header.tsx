import { Menu02Icon } from "@hugeicons/core-free-icons";
import { SidebarTrigger } from "@repo/design-system/components/ui/sidebar-shell";
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
      <div className="flex shrink-0 items-center gap-2">
        {children}
        <SidebarTrigger
          aria-label={t("on-this-page")}
          className="size-9 xl:hidden"
          icon={Menu02Icon}
          size="icon"
          variant="outline"
        />
      </div>
    </BreadcrumbHeaderFrame>
  );
}
