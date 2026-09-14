"use client";

import { usePathname } from "@repo/internationalization/src/navigation";
import { NavExplore } from "@/components/sidebar/nav-explore";
import { NavForYou } from "@/components/sidebar/nav-for-you";
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
export function SidebarNavigation({
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
