"use client";

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
import { usePathname } from "@repo/internationalization/src/navigation";
import { useTranslations } from "next-intl";
import { holyMenu } from "@/components/sidebar/_data/holy";

function MenuItem() {
  const t = useTranslations("Holy");
  const pathname = usePathname();

  return (
    <SidebarMenu>
      {holyMenu.map((item) => (
        <SidebarMenuItem key={item.title}>
          <SidebarMenuButton
            isActive={pathname.includes(item.href)}
            render={<NavigationLink href={item.href} />}
            tooltip={t(item.title)}
          >
            {!!item.icon && <HugeIcons icon={item.icon} />}
            <span className="truncate">{t(item.title)}</span>
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
