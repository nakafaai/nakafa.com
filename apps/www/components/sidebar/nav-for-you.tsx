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
import { useTranslations } from "next-intl";
import {
  getAppNavigationViewer,
  getForYouNavigationItems,
} from "@/components/sidebar/_data/navigation";
import { useUser } from "@/lib/context/use-user";

/**
 * Renders role-aware primary app navigation for students, teachers, parents, and guests.
 */
export function NavForYou() {
  const pathname = usePathname();
  const tAi = useTranslations("Ai");
  const tCommon = useTranslations("Common");
  const { isPending, role } = useUser((state) => ({
    isPending: state.isPending,
    role: state.user?.appUser.role ?? null,
  }));
  const viewer = getAppNavigationViewer({ isPending, role });
  const items = getForYouNavigationItems(viewer);

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

            return (
              <SidebarMenuItem key={item.id}>
                <SidebarMenuButton
                  isActive={pathname.includes(item.href)}
                  render={<NavigationLink href={item.href} title={label} />}
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
