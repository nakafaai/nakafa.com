import { ConvexProvider } from "convex/react";
import type { ReactNode } from "react";
import { clientEnv } from "@/env.public";
import { readConvexClient } from "@/lib/convex/client";

/**
 * Mounts the page's one Convex client for a route whose signed-in readers need it.
 * Only those routes load this module: the account layout with its component chunk,
 * after its gate, and the try-out layout lazily for a signed-in hint, so a
 * visitor's page never loads the client.
 */
export function RouteConvexProvider({ children }: { children: ReactNode }) {
  return (
    <ConvexProvider client={readConvexClient(clientEnv.VITE_CONVEX_URL)}>
      {children}
    </ConvexProvider>
  );
}
