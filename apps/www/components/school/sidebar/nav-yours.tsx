"use client";

import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@repo/design-system/components/ui/sidebar";
import { BellIcon, HomeIcon } from "lucide-react";
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
            <SidebarMenuButton asChild isActive={pathname.includes("/home")}>
              <NavigationLink href={`/school/${slug}/home`} title={t("home")}>
                <HomeIcon />
                {t("home")}
              </NavigationLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={pathname.includes("/notifications")}
            >
              <NavigationLink
                href={`/school/${slug}/notifications`}
                title={t("notifications")}
              >
                <BellIcon />
                {t("notifications")}
              </NavigationLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
