"use client";

import {
  SidebarMenuButton,
  SidebarMenuItem,
} from "@repo/design-system/components/ui/sidebar-menu";
import { usePathname } from "@repo/internationalization/src/navigation";
import { String as Str } from "effect";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { TenantClassesGroup } from "@/components/tenant/classes/nav";
import { useTenant } from "@/components/tenant/context";
import { TenantSidebarGroup } from "@/components/tenant/group";
import { SchoolSettingsNav } from "@/components/tenant/settings/nav";
import { isSchoolSettingsPath } from "@/lib/settings/school";

/**
 * Renders the navigation of the school sidebar. The settings sections replace it
 * on a settings route for a viewer who may manage the school, and otherwise the
 * school's own groups show: the exams for a viewer who may open them, the viewer's
 * classes when the viewer has any, and the management group, with the settings
 * entry, only for a viewer who may manage the school.
 */
export function TenantNavigation() {
  const { canManage, canOpenExams } = useTenant();
  const pathname = usePathname();
  const t = useTranslations("School");
  const tExams = useTranslations("Exams");
  const tSettings = useTranslations("SchoolSettings");

  if (canManage && isSchoolSettingsPath(pathname)) {
    return <SchoolSettingsNav />;
  }

  return (
    <>
      <TenantSidebarGroup label={t("for-you")}>
        <SidebarMenuItem>
          <SidebarMenuButton
            isActive={pathname === "/"}
            render={<Link href="/" />}
          >
            {t("home")}
          </SidebarMenuButton>
        </SidebarMenuItem>
        {canOpenExams ? (
          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={
                pathname === "/exams" || Str.startsWith("/exams/")(pathname)
              }
              render={<Link href="/exams" />}
            >
              {tExams("title")}
            </SidebarMenuButton>
          </SidebarMenuItem>
        ) : null}
      </TenantSidebarGroup>
      <TenantClassesGroup />
      {canManage ? (
        <TenantSidebarGroup label={tSettings("manage-group")}>
          <SidebarMenuItem>
            <SidebarMenuButton render={<Link href="/settings/profile" />}>
              {tSettings("manage-settings")}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </TenantSidebarGroup>
      ) : null}
    </>
  );
}
