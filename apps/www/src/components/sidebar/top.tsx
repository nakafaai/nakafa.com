"use client";

import { Home01Icon, Notification01Icon } from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  SidebarGroup,
  SidebarGroupContent,
} from "@repo/design-system/components/ui/sidebar-content";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@repo/design-system/components/ui/sidebar-menu";
import type { ReactNode } from "react";
import { useTranslations } from "use-intl";
import { Link, type LinkTarget, useRouteMatched } from "@/lib/routing/link";
import { HOME_TARGET } from "@/lib/routing/target";
import { EXACT_ACTIVE_OPTIONS, LOCALE_ROUTE } from "@/lib/routing/tree";

/** Where the inbox lives. */
const NOTIFICATIONS_TARGET = {
  from: LOCALE_ROUTE,
  to: "/$locale/notifications",
} satisfies LinkTarget;

/**
 * The sidebar's first rows, above Study and Explore: the learner's home and
 * their notifications (owner's home sketch, 13 Nov).
 */
export function NavTop() {
  const tCommon = useTranslations("Common");
  const tNotifications = useTranslations("Notifications");
  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu>
          <TopLink target={HOME_TARGET}>
            <HugeIcons icon={Home01Icon} />
            <span className="truncate">{tCommon("home")}</span>
          </TopLink>
          <TopLink target={NOTIFICATIONS_TARGET}>
            <HugeIcons icon={Notification01Icon} />
            <span className="truncate">{tNotifications("title")}</span>
          </TopLink>
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

/** One of the first rows, marked while its page is open. */
function TopLink({
  children,
  target,
}: {
  children: ReactNode;
  target: LinkTarget;
}) {
  const isActive = useRouteMatched(target.to, { exact: false });
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={isActive}
        render={<Link activeOptions={EXACT_ACTIVE_OPTIONS} {...target} />}
      >
        {children}
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
