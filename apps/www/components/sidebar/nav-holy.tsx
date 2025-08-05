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
import { usePathname } from "@repo/internationalization/src/navigation";
import { useTranslations } from "next-intl";
import { holyMenu } from "./_data/holy";

function MenuItem() {
  const t = useTranslations("Holy");
  const pathname = usePathname();

  return (
    <SidebarMenu>
      {holyMenu.map((item) => (
        <SidebarMenuItem key={item.title}>
          <SidebarMenuButton
            asChild
            isActive={pathname.includes(item.href)}
            tooltip={t(item.title)}
          >
            <NavigationLink href={item.href} title={t(item.title)}>
              {item.icon && <item.icon />}
              <span className="truncate">{t(item.title)}</span>
            </NavigationLink>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );
}

export function NavHoly() {
  const t = useTranslations("Holy");

  return (
    <SidebarGroup>
      <SidebarGroupLabel>{t("holy")}</SidebarGroupLabel>
      <SidebarGroupContent>
        <MenuItem />
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
