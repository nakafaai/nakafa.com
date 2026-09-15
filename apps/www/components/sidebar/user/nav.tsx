"use client";

import dynamic from "next/dynamic";
import { AccountPricing } from "@/components/sidebar/menu/pricing";
import { NavUserGuest } from "@/components/sidebar/user/guest/card";
import {
  NavUserAccountSkeleton,
  NavUserSkeleton,
} from "@/components/sidebar/user/skeleton";
import { useViewer } from "@/lib/identity/client";

const NavUserAccount = dynamic(
  () =>
    import("@/components/sidebar/user/account").then(
      (module) => module.NavUserAccount
    ),
  { loading: () => <NavUserAccountSkeleton /> }
);

/** Selects the truthful guest or account footer after authentication settles. */
export function NavUser() {
  const isAuthenticated = useViewer((state) => state.isAuthenticated);
  const isPending = useViewer((state) => state.isPending);
  const user = useViewer((state) => state.account);

  if (isPending) {
    return isAuthenticated ? <NavUserAccountSkeleton /> : <NavUserSkeleton />;
  }
  if (!user) {
    return <NavUserGuest />;
  }
  return (
    <>
      <AccountPricing plan={user.appUser.plan} />
      <NavUserAccount user={user} />
    </>
  );
}
