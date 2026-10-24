import { ConvexProvider } from "convex/react";
import type { ReactNode } from "react";
import { clientEnv } from "@/env.public";
import { readConvexClient } from "@/lib/convex/client";

/**
 * Mounts the page's one Convex client for a route whose signed-in readers need it.
 * The route loads this module lazily, so a visitor's page never loads the client.
 */
export function RouteConvexProvider({ children }: { children: ReactNode }) {
  return (
    <ConvexProvider client={readConvexClient(clientEnv.VITE_CONVEX_URL)}>
      {children}
    </ConvexProvider>
  );
}
