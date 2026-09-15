"use client";

import dynamic from "next/dynamic";
import { AccountPricing } from "@/components/sidebar/menu/pricing";
import { NavUserGuest } from "@/components/sidebar/user/guest/card";
import {
  NavUserAccountSkeleton,
  NavUserSkeleton,
} from "@/components/sidebar/user/skeleton";
import { useViewer } from "@/lib/identity/client";

const SchoolSidebarAccount = dynamic(
  () =>
    import("@/components/school/sidebar/account").then(
      (module) => module.SchoolSidebarAccount
    ),
  { loading: () => <NavUserAccountSkeleton /> }
);

/** Selects the truthful guest or school account footer after auth settles. */
export function SchoolSidebarNavUser() {
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
      <SchoolSidebarAccount user={user} />
    </>
  );
}
