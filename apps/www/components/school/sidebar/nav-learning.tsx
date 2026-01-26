"use client";

import {
  ArrowUpRight01Icon,
  GeometricShapes01Icon,
} from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
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
            <SidebarMenuButton asChild>
              <NavigationLink
                href="/"
                rel="noopener noreferrer"
                target="_blank"
                title={t("nakafa-materials")}
              >
                <HugeIcons icon={ArrowUpRight01Icon} />
                {t("nakafa-materials")}
              </NavigationLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={pathname.includes("/classes")}>
              <NavigationLink
                href={`/school/${slug}/classes`}
                title={t("classes")}
              >
                <HugeIcons icon={GeometricShapes01Icon} />
                {t("classes")}
              </NavigationLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
