"use client";

import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@repo/design-system/components/ui/sidebar";
import { HouseIcon, ShapesIcon } from "lucide-react";
import { useParams, usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

export function SchoolSidebarNavMain() {
  const pathname = usePathname();
  const t = useTranslations("School.Common");

  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={pathname.includes("/dashboard")}
            >
              <NavigationLink
                href={`/school/${slug}/dashboard`}
                title={t("dashboard")}
              >
                <HouseIcon />
                {t("dashboard")}
              </NavigationLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={pathname.includes("/classes")}>
              <NavigationLink
                href={`/school/${slug}/classes`}
                title={t("classes")}
              >
                <ShapesIcon />
                {t("classes")}
              </NavigationLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
