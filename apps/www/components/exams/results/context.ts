import { Id } from "@repo/backend/confect/_generated/id";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";
import { createContext, use } from "react";
import { useConvexAuth } from "@/components/providers/convex";

/** The sitting whose results a screen reads, and the school that holds it. */
const ResultsScope = Schema.Struct({
  sittingId: Id("examSittings"),
  slug: TenantSlug,
});

/**
 * The scope of one results screen. The screen memoizes it from its address, so the value never changes
 * under the screen's content, and every component of the screen reads it without a prop passed down.
 */
export const ResultsScopeContext = createContext<
  typeof ResultsScope.Type | null
>(null);

/** The scope of the results screen that renders the component. */
export function useResultsScope() {
  const scope = use(ResultsScopeContext);
  if (scope === null) {
    throw new Error("useResultsScope must be used within the results screen");
  }
  return scope;
}

/**
 * Whether the browser's session has settled. Every results function reads the session, so each query
 * waits for it and skips until then, as the inbox does.
 */
export function useSessionSettled() {
  return useConvexAuth((auth) => !auth.isLoading);
}
