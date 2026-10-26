import type { ReactNode } from "react";
import { useConvexAuth } from "@/components/auth/convex";

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

/**
 * Renders its children unless the visitor is known to be signed out: while the
 * session and Convex confirm it, and once they have. A view that a signed-in
 * learner had open stays on screen through that wait, and its reads wait for
 * the session's token.
 */
export function UnlessSignedOut({ children }: { children: ReactNode }) {
  const isSignedOut = useConvexAuth(
    (auth) => !(auth.isAuthenticated || auth.isLoading)
  );
  return isSignedOut ? null : children;
}
