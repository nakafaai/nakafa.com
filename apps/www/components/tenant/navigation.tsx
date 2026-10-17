"use client";

import {
  SidebarMenuButton,
  SidebarMenuItem,
} from "@repo/design-system/components/ui/sidebar-menu";
import { usePathname } from "@repo/internationalization/src/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { TenantSidebarGroup } from "@/components/tenant/group";
import { SchoolSettingsNav } from "@/components/tenant/settings/nav";
import { isSchoolSettingsPath } from "@/lib/settings/school";

/**
 * Renders the navigation of the school sidebar. The settings sections replace it
 * on a settings route, and otherwise the school's own groups show. The management
 * group, with the settings entry, shows only to a viewer who may manage the school.
 */
export function TenantNavigation({ canManage }: { canManage: boolean }) {
  const pathname = usePathname();
  const t = useTranslations("School");
  const tSettings = useTranslations("SchoolSettings");

  if (isSchoolSettingsPath(pathname)) {
    return <SchoolSettingsNav />;
  }

  return (
    <>
      <TenantSidebarGroup label={t("for-you")}>
        <SidebarMenuItem>
          <SidebarMenuButton isActive render={<Link href="/" />}>
            {t("home")}
          </SidebarMenuButton>
        </SidebarMenuItem>
      </TenantSidebarGroup>
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
