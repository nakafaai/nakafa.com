"use client";

import {
  DropdownMenuGroup,
  DropdownMenuSeparator,
} from "@repo/design-system/components/ui/dropdown-menu";
import { AnalyticsConsentMenuItem } from "@/components/analytics/consent/actions";
import { AccountMenu } from "@/components/sidebar/menu/account";
import { SidebarUtilityMenuItems } from "@/components/sidebar/menu/utility";
import type { CurrentUser } from "@/lib/identity/client";

/** Renders the school account menu after authentication is confirmed. */
export function SchoolSidebarAccount({ user }: { user: CurrentUser }) {
  return (
    <AccountMenu user={user}>
      <SidebarUtilityMenuItems />
      <DropdownMenuSeparator />
      <DropdownMenuGroup>
        <AnalyticsConsentMenuItem />
      </DropdownMenuGroup>
    </AccountMenu>
  );
}
