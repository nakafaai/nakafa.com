"use client";

import dynamic from "next/dynamic";
import { NavUserGuest } from "@/components/sidebar/user/guest/panel";
import { NavUserSkeleton } from "@/components/sidebar/user/skeleton";
import { useUser } from "@/lib/context/use-user";

const NavUserAccount = dynamic(
  () =>
    import("@/components/sidebar/user/account").then(
      (module) => module.NavUserAccount
    ),
  { loading: () => <NavUserSkeleton mode="account" /> }
);

/** Selects the truthful guest or account footer after authentication settles. */
export function NavUser() {
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
  return <NavUserAccount user={user} />;
}
