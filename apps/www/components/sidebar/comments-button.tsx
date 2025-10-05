"use client";

import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import {
  SidebarMenuButton,
  SidebarMenuItem,
} from "@repo/design-system/components/ui/sidebar";
import { MessagesSquareIcon } from "lucide-react";
import { useTranslations } from "next-intl";

export function CommentsButton() {
  const t = useTranslations("Common");

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild tooltip={t("comments")}>
        <NavigationLink href="#comments" title={t("comments")}>
          <MessagesSquareIcon className="size-4 shrink-0" />
          <span className="truncate">{t("comments")}</span>
        </NavigationLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
