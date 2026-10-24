"use client";

import { SidebarFooter } from "@repo/design-system/components/ui/sidebar-content";
import { SidebarMenu } from "@repo/design-system/components/ui/sidebar-menu";
import { lazy, Suspense } from "react";
import { SignedInIsland } from "@/components/providers/island";
import { AccountPricing } from "@/components/sidebar/menu/pricing";
import { NavUserGuest } from "@/components/sidebar/user/guest/card";
import { useViewer } from "@/lib/identity/client";

const NavUserAccount = lazy(() =>
  import("@/components/sidebar/user/account").then((module) => ({
    default: module.NavUserAccount,
  }))
);

/**
 * Renders the guest footer or the account footer. Two slots hold them, and the
 * root's signed-in hint shows one before the first paint, so a visitor's footer
 * never waits on the account and a learner's never shows the guest card. Only the
 * account slot mounts the page's Convex island.
 */
export function NavUser() {
  return (
    <>
      <SidebarFooter className="border-t" data-account="visitor">
        <SidebarMenu>
          <NavUserGuest />
        </SidebarMenu>
      </SidebarFooter>
      <SidebarFooter className="border-t" data-account="member">
        <SidebarMenu>
          <SignedInIsland>
            <NavUserMember />
          </SignedInIsland>
        </SidebarMenu>
      </SidebarFooter>
    </>
  );
}

/**
 * The learner's footer, read on the page's Convex island. It renders nothing while
 * the account settles, the plan and menu of a signed-in account, and the guest
 * card when Convex reports no account for the session.
 */
function NavUserMember() {
  const isPending = useViewer((state) => state.isPending);
  const user = useViewer((state) => state.account);

  if (isPending) {
    return null;
  }
  if (!user) {
    return <NavUserGuest />;
  }
  return (
    <>
      <AccountPricing plan={user.appUser.plan} />
      <Suspense fallback={null}>
        <NavUserAccount user={user} />
      </Suspense>
    </>
  );
}
