"use client";

import type { IconSvgElement } from "@hugeicons/react";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
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
import {
  EXACT_ACTIVE_OPTIONS,
  Link,
  type LinkTarget,
  useRouteMatched,
} from "@repo/internationalization/src/link";
import { articleCategoryTarget } from "@repo/internationalization/src/target";
import { Array as Arr } from "effect";
import { useTranslations } from "use-intl";
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
  const tCommon = useTranslations("Common");
  const tHoly = useTranslations("Holy");
  const items = [
    ...Arr.map(holyMenu, (item) => ({
      icon: item.icon,
      label: tHoly(item.title),
      target: item.target,
    })),
    ...Arr.zipWith(articleNavigation, articleIcons, (item, icon) => ({
      icon,
      label: item.title,
      target: articleCategoryTarget(item.route),
    })),
  ];

  return (
    <SidebarGroup>
      <SidebarGroupLabel>{tCommon("explore")}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {Arr.map(items, (item) => (
            <ExploreItem
              icon={item.icon}
              key={item.target.to}
              label={item.label}
              target={item.target}
            />
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

/** One exploration link, which is active on its own page, as the router's match says. */
function ExploreItem({
  icon,
  label,
  target,
}: {
  icon: IconSvgElement;
  label: string;
  target: LinkTarget;
}) {
  const isActive = useRouteMatched(target.to, { exact: true });

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={isActive}
        render={
          <Link
            activeOptions={EXACT_ACTIVE_OPTIONS}
            {...target}
            title={label}
          />
        }
        tooltip={label}
      >
        <HugeIcons icon={icon} />
        <span className="truncate">{label}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
