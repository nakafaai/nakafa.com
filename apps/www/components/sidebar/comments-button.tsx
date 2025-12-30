"use client";

import { MessageMultiple01Icon } from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import {
  SidebarMenuButton,
  SidebarMenuItem,
} from "@repo/design-system/components/ui/sidebar";
import { useTranslations } from "next-intl";

export function CommentsButton() {
  const t = useTranslations("Common");

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild tooltip={t("comments")}>
        <NavigationLink href="#comments" title={t("comments")}>
          <HugeIcons className="shrink-0" icon={MessageMultiple01Icon} />
          <span className="truncate">{t("comments")}</span>
        </NavigationLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
