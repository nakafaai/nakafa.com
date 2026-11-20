import { ConvexProvider } from "convex/react";
import { Option } from "effect";
import type { ReactNode } from "react";
import { SignedInIsland } from "@/components/providers/island";
import { useLiveSession } from "@/components/providers/live";
import { clientEnv } from "@/env.public";
import { hasSignedInHint } from "@/lib/auth/hint";
import { readVisitorClient } from "@/lib/convex/visitor";

/**
 * The Convex client a visited world reads through (ADR 0050, W6). A learner
 * reads through the page's client, under their session, so the greeting they
 * leave is theirs. A visitor without an account reads through the visitor's
 * client, which waits for no session. A page whose hint says a session may
 * exist draws nothing until the session answers, so the world is never drawn
 * once as a visitor's and again as a learner's.
 */
export function WorldClient({ children }: { children: ReactNode }) {
  const isSettled = useLiveSession(
    (state) =>
      state.hasError || (Option.isSome(state.client) && !state.isPending)
  );
  if (hasSignedInHint(document.cookie) && !isSettled) {
    return null;
  }
  return (
    <SignedInIsland
      fallback={
        <ConvexProvider client={readVisitorClient(clientEnv.VITE_CONVEX_URL)}>
          {children}
        </ConvexProvider>
      }
    >
      {children}
    </SignedInIsland>
  );
}
