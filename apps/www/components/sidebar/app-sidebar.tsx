"use client";

import {
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
} from "@repo/design-system/components/ui/sidebar-content";
import { SidebarMenu } from "@repo/design-system/components/ui/sidebar-menu";
import { Sidebar } from "@repo/design-system/components/ui/sidebar-shell";
import { usePathname } from "@repo/internationalization/src/navigation";
import { cn } from "cn";
import type { ComponentProps } from "react";
import { HeaderMenu } from "@/components/sidebar/header-menu";
import { NavExplore } from "@/components/sidebar/nav-explore";
import { NavForYou } from "@/components/sidebar/nav-for-you";
import { SearchMenu } from "@/components/sidebar/search-menu";
import { NavUser } from "@/components/sidebar/user/nav";
import { UserSettingsNav } from "@/components/user/settings/nav";
import type { ArticleNavigationItem } from "@/lib/content/article/navigation";
import { isUserSettingsPath } from "@/lib/settings/routes";

/**
 * Renders the navigation owned by the current route surface.
 *
 * Settings swaps its own sections into the sidebar body while the header,
 * footer, and panel geometry stay mounted, so switching surfaces cannot shift
 * or remount the shell around it.
 */
function SidebarNavigation({
  articleNavigation,
}: {
  articleNavigation: readonly ArticleNavigationItem[];
}) {
  const pathname = usePathname();

  if (isUserSettingsPath(pathname)) {
    return <UserSettingsNav />;
  }

  return (
    <>
      <NavForYou />
      <NavExplore articleNavigation={articleNavigation} />
    </>
  );
}

export function AppSidebar({
  articleNavigation,
  ...props
}: ComponentProps<typeof Sidebar> & {
  articleNavigation: readonly ArticleNavigationItem[];
}) {
  return (
    <Sidebar className={cn("z-20", props.className)} side="left" {...props}>
      <SidebarHeader className="border-b">
        <HeaderMenu />
        <SearchMenu />
      </SidebarHeader>
      <SidebarContent>
        <SidebarNavigation articleNavigation={articleNavigation} />
      </SidebarContent>
      <SidebarFooter className="border-t">
        <SidebarMenu>
          <NavUser />
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
