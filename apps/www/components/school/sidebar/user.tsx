"use client";

import dynamic from "next/dynamic";
import { NavUserGuest } from "@/components/sidebar/user/guest/panel";
import { NavUserSkeleton } from "@/components/sidebar/user/skeleton";
import { useUser } from "@/lib/context/use-user";

const SchoolSidebarAccount = dynamic(
  () =>
    import("@/components/school/sidebar/account").then(
      (module) => module.SchoolSidebarAccount
    ),
  { loading: () => <NavUserSkeleton mode="account" /> }
);

/** Selects the truthful guest or school account footer after auth settles. */
export function SchoolSidebarNavUser() {
  const { isAuthenticated, isPending, user } = useUser((state) => ({
    isAuthenticated: state.isAuthenticated,
    isPending: state.isPending,
    user: state.user,
  }));

  if (isPending) {
    return <NavUserSkeleton mode={isAuthenticated ? "account" : "neutral"} />;
  }
  if (!user) {
    return <NavUserGuest />;
  }
  return <SchoolSidebarAccount user={user} />;
}
