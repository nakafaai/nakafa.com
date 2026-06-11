"use client";

import { Home07Icon, Notification01Icon } from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/icons/huge-icons";
import NavigationLink from "@repo/design-system/components/navigation/link";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@repo/design-system/components/ui/sidebar";
import { useParams, usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

export function SchoolSidebarNavYours() {
  const pathname = usePathname();
  const t = useTranslations("School.Common");

  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  return (
    <SidebarGroup>
      <SidebarGroupLabel>{t("yours")}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={pathname.includes("/home")}
              render={
                <NavigationLink
                  href={`/school/${slug}/home`}
                  title={t("home")}
                />
              }
            >
              <HugeIcons icon={Home07Icon} />
              {t("home")}
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={pathname.includes("/notifications")}
              render={
                <NavigationLink
                  href={`/school/${slug}/notifications`}
                  title={t("notifications")}
                />
              }
            >
              <HugeIcons icon={Notification01Icon} />
              {t("notifications")}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
