"use client";

import dynamic from "next/dynamic";
import { AccountPricing } from "@/components/sidebar/menu/pricing";
import { NavUserGuest } from "@/components/sidebar/user/guest/card";
import {
  NavUserAccountSkeleton,
  NavUserSkeleton,
} from "@/components/sidebar/user/skeleton";
import { useUser } from "@/lib/context/use-user";

const NavUserAccount = dynamic(
  () =>
    import("@/components/sidebar/user/account").then(
      (module) => module.NavUserAccount
    ),
  { loading: () => <NavUserAccountSkeleton /> }
);

/** Selects the truthful guest or account footer after authentication settles. */
export function NavUser() {
  const { isAuthenticated, isPending, user } = useUser((state) => ({
    isAuthenticated: state.isAuthenticated,
    isPending: state.isPending,
    user: state.user,
  }));

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
