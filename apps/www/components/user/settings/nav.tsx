"use client";

import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
} from "@repo/design-system/components/ui/sidebar-content";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@repo/design-system/components/ui/sidebar-menu";
import { usePathname } from "@repo/internationalization/src/navigation";
import { useTranslations } from "next-intl";
import { userSettingsSections } from "@/lib/settings/routes";

/**
 * Renders the private settings sections as the sidebar body for settings
 * routes, replacing the browsing navigation without replacing the shell.
 */
export function UserSettingsNav() {
  const pathname = usePathname();
  const t = useTranslations("Auth");

  return (
    <SidebarGroup>
      <SidebarGroupLabel>{t("personal")}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {userSettingsSections.map((section) => {
            const label = t(section.labelKey);

            return (
              <SidebarMenuItem key={section.href}>
                <SidebarMenuButton
                  isActive={pathname === section.href}
                  render={<NavigationLink href={section.href} title={label} />}
                  tooltip={label}
                >
                  <HugeIcons icon={section.icon} />
                  <span className="truncate">{label}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
