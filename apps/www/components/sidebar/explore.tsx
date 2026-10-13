"use client";

import type { IconSvgElement } from "@hugeicons/react";
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
import { Array as Arr } from "effect";
import { useTranslations } from "next-intl";
import { holyMenu } from "@/components/sidebar/data/holy";
import type { ArticleNavigationItem } from "@/lib/content/article/navigation";

/**
 * Renders the public exploration links that stay useful for every viewer type.
 *
 * The shell takes the icon of each article category on the server and passes
 * only the icons here, one for each item of `articleNavigation` in the same
 * order, so the families of icons that a category picks from stay out of the
 * JavaScript of every page.
 */
export function NavExplore({
  articleIcons,
  articleNavigation,
}: {
  articleIcons: readonly IconSvgElement[];
  articleNavigation: readonly ArticleNavigationItem[];
}) {
  const pathname = usePathname();
  const tCommon = useTranslations("Common");
  const tHoly = useTranslations("Holy");
  const items = [
    ...Arr.map(holyMenu, (item) => ({
      href: item.href,
      icon: item.icon,
      label: tHoly(item.title),
    })),
    ...Arr.zipWith(articleNavigation, articleIcons, (item, icon) => ({
      href: item.href,
      icon,
      label: item.title,
    })),
  ];

  return (
    <SidebarGroup>
      <SidebarGroupLabel>{tCommon("explore")}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {Arr.map(items, (item) => (
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
