"use client";

import { Authenticated, Unauthenticated } from "convex/react";
import { AuthGoogle } from "@/components/auth/google";
import { AuthLogout } from "@/components/auth/logout";

export function Auth() {
  return (
    <div className="flex min-h-9 items-center justify-center">
      <Unauthenticated>
        <AuthGoogle />
      </Unauthenticated>

      <Authenticated>
        <AuthLogout />
      </Authenticated>
    </div>
  );
}
