"use client";

import { SidebarFooter } from "@repo/design-system/components/ui/sidebar-content";
import { SidebarMenu } from "@repo/design-system/components/ui/sidebar-menu";
import dynamic from "next/dynamic";
import { AccountPricing } from "@/components/sidebar/menu/pricing";
import { NavUserGuest } from "@/components/sidebar/user/guest/card";
import { NavUserAccountSkeleton } from "@/components/sidebar/user/skeleton";
import { useViewer } from "@/lib/identity/client";

const SchoolSidebarAccount = dynamic(
  () =>
    import("@/components/school/sidebar/account").then(
      (module) => module.SchoolSidebarAccount
    ),
  { loading: () => <NavUserAccountSkeleton /> }
);

/** Renders the School guest or account footer once authentication settles. */
export function SchoolSidebarNavUser() {
  const isPending = useViewer((state) => state.isPending);
  const user = useViewer((state) => state.account);

  if (isPending) {
    return null;
  }
  return (
    <SidebarFooter className="border-t">
      <SidebarMenu>
        {user ? (
          <>
            <AccountPricing plan={user.appUser.plan} />
            <SchoolSidebarAccount user={user} />
          </>
        ) : (
          <NavUserGuest />
        )}
      </SidebarMenu>
    </SidebarFooter>
  );
}
