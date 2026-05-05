"use client";

import { Skeleton } from "@repo/design-system/components/ui/skeleton";
import { Authenticated, AuthLoading, Unauthenticated } from "convex/react";
import { AuthGoogle } from "@/components/auth/google";
import { AuthLogout } from "@/components/auth/logout";

export function Auth() {
  return (
    <>
      <Unauthenticated>
        <AuthGoogle />
      </Unauthenticated>

      <Authenticated>
        <AuthLogout />
      </Authenticated>

      <AuthLoading>
        <Skeleton className="mx-auto h-9 w-1/2" />
      </AuthLoading>
    </>
  );
}
