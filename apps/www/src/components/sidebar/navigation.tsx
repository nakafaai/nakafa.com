"use client";

import { usePathname } from "@repo/internationalization/src/navigation";
import type { ReactNode } from "react";
import { UserSettingsNav } from "@/components/user/settings/nav";
import { isUserSettingsPath } from "@/lib/settings/routes";

/**
 * Renders the navigation owned by the current route surface.
 *
 * Settings swaps its own sections into the sidebar body while the header,
 * footer, and panel geometry stay mounted, so switching surfaces cannot shift
 * or remount the shell around it. The browsing navigation arrives as a slot,
 * so this chooser never carries data it does not render itself.
 */
export function SidebarNavigation({ browse }: { browse: ReactNode }) {
  const pathname = usePathname();

  if (isUserSettingsPath(pathname)) {
    return <UserSettingsNav />;
  }

  return <>{browse}</>;
}
