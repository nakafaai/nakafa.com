import { Id } from "@repo/backend/confect/_generated/id";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { useRequired } from "@repo/design-system/hooks/required";
import { Schema } from "effect";
import { createContext } from "react";
import { useConvexAuth } from "@/components/auth/convex";

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
  return useRequired(ResultsScopeContext, "useResultsScope");
}

/**
 * What every row reads from the sitting: its unit's time zone, the total points of its questions, and
 * whether the viewer grades its answers.
 */
const ResultsPaper = Schema.Struct({
  canGrade: Schema.Boolean,
  timeZone: Schema.String,
  total: Schema.Finite,
});

/**
 * The sitting's time zone and question count, which the screen reads once with the overview and every
 * student's row shows, so no table passes them down.
 */
export const ResultsPaperContext = createContext<
  typeof ResultsPaper.Type | null
>(null);

/** The time zone and the question count of the results screen that renders the component. */
export function useResultsPaper() {
  return useRequired(ResultsPaperContext, "useResultsPaper");
}

/**
 * Whether the browser's session has settled. Every results function reads the session, so each query
 * waits for it and skips until then, as the inbox does.
 */
export function useSessionSettled() {
  return useConvexAuth((auth) => !auth.isLoading);
}
