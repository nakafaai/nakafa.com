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
import { ShapesIcon } from "lucide-react";
import { useParams, usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

export function SchoolSidebarNavLearning() {
  const pathname = usePathname();
  const t = useTranslations("School.Common");

  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  return (
    <SidebarGroup>
      <SidebarGroupLabel>{t("learning")}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
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
