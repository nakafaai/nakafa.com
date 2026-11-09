import { ConvexProvider } from "convex/react";
import type { ReactNode } from "react";
import { clientEnv } from "@/env.public";
import { readVisitorClient } from "@/lib/convex/visitor";

/**
 * Gives a visitor's comments the read-only client they read through (`readVisitorClient`). This module loads
 * with the comments, once they come near the viewport, so a visitor who never scrolls there loads no client.
 */
export function VisitorIsland({ children }: { children: ReactNode }) {
  return (
    <ConvexProvider client={readVisitorClient(clientEnv.VITE_CONVEX_URL)}>
      {children}
    </ConvexProvider>
  );
}
