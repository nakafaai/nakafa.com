"use client";

import type { ReactNode } from "react";
import { SettingsReturnProvider } from "@/components/shared/settings/return";
import { UserSettingsNav } from "@/components/user/settings/nav";
import { useRouteMatched } from "@/lib/routing/link";

/**
 * Renders the navigation owned by the current route surface.
 *
 * Settings swaps its own sections into the sidebar body while the header,
 * footer, and panel geometry stay mounted, so switching surfaces cannot shift
 * or remount the shell around it. The browsing navigation arrives as a slot,
 * so this chooser never carries data it does not render itself. It stays
 * mounted from the page the learner leaves into settings, so it remembers that
 * page for the settings' way back.
 */
export function SidebarNavigation({ browse }: { browse: ReactNode }) {
  const isSettings = useRouteMatched("/$locale/user/settings", {
    exact: false,
  });

  return (
    <SettingsReturnProvider path="/$locale/user/settings">
      {isSettings ? <UserSettingsNav /> : browse}
    </SettingsReturnProvider>
  );
}
