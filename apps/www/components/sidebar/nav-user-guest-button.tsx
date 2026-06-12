"use client";

import { BookOpen02Icon, MoreVerticalIcon } from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { SidebarMenuButton } from "@repo/design-system/components/ui/sidebar";
import { useTranslations } from "next-intl";

/**
 * Renders the signed-out sidebar footer trigger with the same footprint as the
 * signed-in profile trigger so auth hydration never changes footer height.
 */
export function NavUserGuestButton() {
  const t = useTranslations("Auth");

  return (
    <SidebarMenuButton size="lg">
      <div className="flex aspect-square size-8 items-center justify-center rounded-md bg-foreground text-background">
        <HugeIcons className="size-4" icon={BookOpen02Icon} />
      </div>
      <div className="grid min-w-0 flex-1 text-left text-sm leading-tight">
        <span className="truncate font-medium">{t("login")}</span>
        <span className="truncate text-muted-foreground text-xs">
          {t("account")}
        </span>
      </div>
      <HugeIcons className="ml-auto size-4" icon={MoreVerticalIcon} />
    </SidebarMenuButton>
  );
}
