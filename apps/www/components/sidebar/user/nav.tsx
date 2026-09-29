"use client";

import { SidebarFooter } from "@repo/design-system/components/ui/sidebar-content";
import { SidebarMenu } from "@repo/design-system/components/ui/sidebar-menu";
import dynamic from "next/dynamic";
import { AccountPricing } from "@/components/sidebar/menu/pricing";
import { NavUserGuest } from "@/components/sidebar/user/guest/card";
import { NavUserAccountSkeleton } from "@/components/sidebar/user/skeleton";
import { useViewer } from "@/lib/identity/client";

const NavUserAccount = dynamic(
  () =>
    import("@/components/sidebar/user/account").then(
      (module) => module.NavUserAccount
    ),
  { loading: () => <NavUserAccountSkeleton /> }
);

/**
 * Renders the guest or account footer once authentication settles. Guest,
 * Free and Pro footers differ in height, so no truthful placeholder exists
 * before then; inserting the settled footer at the bottom moves nothing above.
 */
export function NavUser() {
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
            <NavUserAccount user={user} />
          </>
        ) : (
          <NavUserGuest />
        )}
      </SidebarMenu>
    </SidebarFooter>
  );
}
