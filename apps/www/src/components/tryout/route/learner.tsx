import {
  useRouteContext,
  useRouter,
  useRouterState,
} from "@tanstack/react-router";
import { useEffect } from "react";
import { hasSignedInHint } from "@/lib/auth/hint";

/**
 * Reads the learner's own answer once a page that the build prerendered for every
 * visitor has hydrated. A track, a set and a section are static pages (ADR 0038
 * Phase B), so their first HTML is a visitor's. A signed-in hint, or an address
 * bound to an attempt, runs the try-out layout and the page's loaders again, which
 * mount the Convex client and read the learner's attempt, while the visitor's
 * page stays on screen. A page that the server rendered for its own request reads
 * nothing again.
 */
export function TryoutLearnerAnswer() {
  const router = useRouter();
  const prerendered = useRouteContext({
    from: "/$locale/_main/try-out",
    select: (context) => context.prerendered,
  });
  const bound = useRouterState({
    select: (state) => "attemptId" in state.location.search,
  });

  useEffect(() => {
    if (prerendered && (bound || hasSignedInHint(document.cookie))) {
      router.invalidate();
    }
  }, [bound, prerendered, router]);

  return null;
}
