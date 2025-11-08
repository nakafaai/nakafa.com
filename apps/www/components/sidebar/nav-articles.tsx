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
import { Suspense } from "react";
import { articlesMenu } from "./_data/articles";

function MenuItem() {
  return (
    <SidebarMenu>
      {articlesMenu.map((item) => (
        <SidebarMenuItem key={item.title}>
          <Suspense>
            <MenuItemButton item={item} />
          </Suspense>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );
}

function MenuItemButton({ item }: { item: (typeof articlesMenu)[number] }) {
  const pathname = usePathname();
  const t = useTranslations("Articles");
  return (
    <SidebarMenuButton asChild isActive={pathname.includes(item.href)}>
      <NavigationLink href={item.href} title={t(item.title)}>
        {item.icon}
        <span className="truncate">{t(item.title)}</span>
      </NavigationLink>
    </SidebarMenuButton>
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
