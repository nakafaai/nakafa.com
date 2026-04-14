"use client";

import { Authenticated, AuthLoading, Unauthenticated } from "convex/react";
import { SchoolAuthScreen } from "@/components/school/auth-screen";
import { SchoolLoader } from "@/components/school/loader";

/** Gates the authenticated school subtree behind the shared school auth screen. */
export function LayoutAuth({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Authenticated>{children}</Authenticated>

      <Unauthenticated>
        <SchoolAuthScreen />
      </Unauthenticated>

      <AuthLoading>
        <SchoolLoader />
      </AuthLoading>
    </>
  );
}
