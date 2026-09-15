"use client";

import type { api } from "@repo/backend/convex/_generated/api";
import type { Preloaded } from "convex/react";
import type { ReactNode } from "react";
import {
  IdentityProvider,
  SeededIdentityProvider,
} from "@/lib/identity/client";

/**
 * Seeds the home subtree with the account the route already resolved.
 *
 * A protected route reads its own request token, so seeding keeps the greeting
 * in the first client paint. Without a resolved account the subtree falls back
 * to the live session instead of rendering an empty identity.
 */
export function HomeSeed({
  children,
  viewer,
}: {
  children: ReactNode;
  viewer: Preloaded<typeof api.auth.queries.getCurrentUser> | null;
}) {
  if (!viewer) {
    return <IdentityProvider>{children}</IdentityProvider>;
  }

  return (
    <SeededIdentityProvider seed={viewer}>{children}</SeededIdentityProvider>
  );
}
