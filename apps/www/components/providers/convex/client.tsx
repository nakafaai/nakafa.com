"use client";

import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react";
import { ConvexReactClient } from "convex/react";
import type { ReactNode } from "react";
import { env } from "@/env";
import { authClient } from "@/lib/auth/client";

const convex = new ConvexReactClient(env.NEXT_PUBLIC_CONVEX_URL, {
  // Optionally pause queries until the user is authenticated
  expectAuth: true,
});

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  return (
    <ConvexBetterAuthProvider authClient={authClient} client={convex}>
      {children}
    </ConvexBetterAuthProvider>
  );
}
