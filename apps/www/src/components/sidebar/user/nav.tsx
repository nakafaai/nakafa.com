"use client";

import { SidebarFooter } from "@repo/design-system/components/ui/sidebar-content";
import { SidebarMenu } from "@repo/design-system/components/ui/sidebar-menu";
import { lazy } from "@repo/design-system/lib/lazy";
import { Suspense } from "react";
import { SignedInIsland } from "@/components/providers/island";
import { AccountPricing } from "@/components/sidebar/menu/pricing";
import { NavUserGuest } from "@/components/sidebar/user/guest/card";
import { KeptAccount } from "@/components/sidebar/user/kept";
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
 * account slot mounts the page's Convex island. The account slot draws the row
 * the browser kept in the first frame (`KeptAccount`), and takes no room while it
 * holds no row to show.
 */
export function NavUser() {
  return (
    <>
      <SidebarFooter className="border-t" data-account="visitor">
        <SidebarMenu>
          <NavUserGuest />
        </SidebarMenu>
      </SidebarFooter>
      <SidebarFooter
        className="border-t not-has-[li]:hidden"
        data-account="member"
      >
        <SidebarMenu>
          <SignedInIsland fallback={<KeptAccount />}>
            <NavUserMember />
          </SignedInIsland>
        </SidebarMenu>
      </SidebarFooter>
    </>
  );
}

/**
 * The learner's footer, read on the page's Convex island. It keeps the row the
 * browser kept while the account settles, then shows the plan and menu of a
 * signed-in account, and the guest card when Convex reports no account for the
 * session. The account's menu loads on its own, and the kept row holds the
 * footer, pricing included, until it arrives, so the footer keeps its height.
 */
function NavUserMember() {
  const isPending = useViewer((state) => state.isPending);
  const user = useViewer((state) => state.account);

  if (isPending) {
    return <KeptAccount />;
  }
  if (!user) {
    return <NavUserGuest />;
  }
  return (
    <Suspense fallback={<KeptAccount />}>
      <AccountPricing plan={user.appUser.plan} />
      <NavUserAccount user={user} />
    </Suspense>
  );
}
