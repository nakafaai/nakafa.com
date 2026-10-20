"use client";

import type { ReactNode } from "react";
import { useConvexAuth } from "@/components/providers/convex";

/** Renders its children once Convex has confirmed a signed-in session. */
export function Authenticated({ children }: { children: ReactNode }) {
  const isAuthenticated = useConvexAuth(
    (auth) => auth.isAuthenticated && !auth.isLoading
  );
  return isAuthenticated ? children : null;
}

/** Renders its children once the visitor is known to be signed out. */
export function Unauthenticated({ children }: { children: ReactNode }) {
  const isUnauthenticated = useConvexAuth(
    (auth) => !(auth.isAuthenticated || auth.isLoading)
  );
  return isUnauthenticated ? children : null;
}
