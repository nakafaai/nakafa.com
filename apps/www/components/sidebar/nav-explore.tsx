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
import { getArticleCategoryIcon } from "@/components/articles/category";
import { holyMenu } from "@/components/sidebar/data/holy";
import type { ArticleNavigationItem } from "@/lib/content/article/navigation";

/**
 * Renders the public exploration links that stay useful for every viewer type.
 */
export function NavExplore({
  articleNavigation,
}: {
  articleNavigation: readonly ArticleNavigationItem[];
}) {
  const pathname = usePathname();
  const tCommon = useTranslations("Common");
  const tHoly = useTranslations("Holy");
  const items = [
    ...holyMenu.map((item) => ({
      href: item.href,
      icon: item.icon,
      label: tHoly(item.title),
    })),
    ...articleNavigation.map((item) => ({
      href: item.href,
      icon: getArticleCategoryIcon(item.category),
      label: item.title,
    })),
  ];

  return (
    <SidebarGroup>
      <SidebarGroupLabel>{tCommon("explore")}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton
                isActive={pathname.includes(item.href)}
                render={<NavigationLink href={item.href} title={item.label} />}
                tooltip={item.label}
              >
                <HugeIcons icon={item.icon} />
                <span className="truncate">{item.label}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
