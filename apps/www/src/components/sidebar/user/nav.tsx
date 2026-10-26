"use client";

import { SidebarFooter } from "@repo/design-system/components/ui/sidebar-content";
import { SidebarMenu } from "@repo/design-system/components/ui/sidebar-menu";
import { ClientOnly } from "@tanstack/react-router";
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

const KnownAccountRow = lazy(() =>
  import("@/components/sidebar/user/account").then((module) => ({
    default: module.KnownAccountRow,
  }))
);

/**
 * Renders the guest footer or the account footer. Two slots hold them, and the
 * root's signed-in hint shows one before the first paint, so a visitor's footer
 * never waits on the account and a learner's never shows the guest card. Only the
 * account slot mounts the page's Convex island. The account slot takes no room
 * while it holds no item, so the row it receives appears without moving the
 * footer's edge, which would count as a layout shift.
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
        className="not-has-[li]:hidden border-t"
        data-account="member"
      >
        <SidebarMenu>
          <SignedInIsland fallback={<KnownAccount />}>
            <NavUserMember />
          </SignedInIsland>
        </SidebarMenu>
      </SidebarFooter>
    </>
  );
}

/**
 * The account row the browser kept for the session, drawn once the page has
 * hydrated, because the server keeps nothing for the browser. It holds the
 * footer while the live session and the account load.
 */
function KnownAccount() {
  return (
    <ClientOnly fallback={null}>
      <Suspense fallback={null}>
        <KnownAccountRow />
      </Suspense>
    </ClientOnly>
  );
}

/**
 * The learner's footer, read on the page's Convex island. It keeps the row the
 * browser kept while the account settles, then shows the plan and menu of a
 * signed-in account, and the guest card when Convex reports no account for the
 * session.
 */
function NavUserMember() {
  const isPending = useViewer((state) => state.isPending);
  const user = useViewer((state) => state.account);

  if (isPending) {
    return <KnownAccount />;
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
