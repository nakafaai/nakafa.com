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
import {
  usePathname,
  useRouter,
} from "@repo/internationalization/src/navigation";
import { Array as Arr } from "effect";
import { useLocale, useTranslations } from "next-intl";
import {
  getForYouNavigationHref,
  getForYouNavigationItems,
} from "@/components/sidebar/data/navigation";
import { usePreferredCurriculumHref } from "@/lib/curriculum/preferences";
import { usePreferredTryoutHref } from "@/lib/tryout/preferences";

/**
 * Renders the primary app navigation shared by every audience.
 */
export function NavForYou() {
  const pathname = usePathname();
  const router = useRouter();
  const tAi = useTranslations("Ai");
  const tCommon = useTranslations("Common");
  const locale = useLocale();
  const items = getForYouNavigationItems();
  const preferredCurriculumHref = usePreferredCurriculumHref(locale);
  const preferredTryoutHref = usePreferredTryoutHref(locale);

  return (
    <SidebarGroup>
      <SidebarGroupLabel>{tCommon("for-you")}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {Arr.map(items, (item) => {
            const label =
              item.labelNamespace === "Ai"
                ? tAi(item.labelKey)
                : tCommon(item.labelKey);
            const href = getForYouNavigationHref(item, locale, {
              preferredCurriculumHref,
              preferredTryoutHref,
            });
            const prefetchChat =
              item.id === "askNina" ? () => router.prefetch(href) : undefined;

            return (
              <SidebarMenuItem key={item.id}>
                <SidebarMenuButton
                  isActive={pathname.includes(href)}
                  render={
                    <NavigationLink
                      href={href}
                      onFocus={prefetchChat}
                      onPointerEnter={prefetchChat}
                      onTouchStart={prefetchChat}
                      prefetch={item.id === "askNina" ? false : undefined}
                      title={label}
                    />
                  }
                  tooltip={label}
                >
                  <HugeIcons icon={item.icon} />
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
