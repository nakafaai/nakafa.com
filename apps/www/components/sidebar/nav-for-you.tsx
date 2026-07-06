"use client";

import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
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
import { useLocale, useTranslations } from "next-intl";
import {
  getAppNavigationViewer,
  getForYouNavigationHref,
  getForYouNavigationItems,
} from "@/components/sidebar/data/navigation";
import { useUser } from "@/lib/context/use-user";
import { usePreferredCurriculumHref } from "@/lib/curriculum/preferences";
import { usePreferredTryoutHref } from "@/lib/tryout/preferences";

/**
 * Renders role-aware primary app navigation for students, teachers, parents, and guests.
 */
export function NavForYou() {
  const pathname = usePathname();
  const tAi = useTranslations("Ai");
  const tCommon = useTranslations("Common");
  const locale = useLocale();
  const { isPending, role } = useUser((state) => ({
    isPending: state.isPending,
    role: state.user?.appUser.role ?? null,
  }));
  const viewer = getAppNavigationViewer({ isPending, role });
  const items = getForYouNavigationItems(viewer);
  const preferredCurriculumHref = usePreferredCurriculumHref(locale);
  const preferredTryoutHref = usePreferredTryoutHref(locale);

  return (
    <SidebarGroup>
      <SidebarGroupLabel>{tCommon("for-you")}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => {
            const label =
              item.labelNamespace === "Ai"
                ? tAi(item.labelKey)
                : tCommon(item.labelKey);
            const href = getForYouNavigationHref(item, locale, {
              preferredCurriculumHref,
              preferredTryoutHref,
            });

            return (
              <SidebarMenuItem key={item.id}>
                <SidebarMenuButton
                  isActive={pathname.includes(href)}
                  render={<NavigationLink href={href} title={label} />}
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
