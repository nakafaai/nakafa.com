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
import { articlesMenu } from "@/components/sidebar/_data/articles";

function MenuItem() {
  const t = useTranslations("Articles");
  const pathname = usePathname();

  return (
    <SidebarMenu>
      {articlesMenu.map((item) => (
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

export function NavArticles() {
  const t = useTranslations("Common");

  return (
    <SidebarGroup>
      <SidebarGroupLabel>{t("articles")}</SidebarGroupLabel>
      <SidebarGroupContent>
        <MenuItem />
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
