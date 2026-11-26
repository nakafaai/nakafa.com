import type { Leader, Week } from "@repo/backend/confect/progress/view";
import { useRequired } from "@repo/design-system/hooks/required";
import type { Option } from "effect";
import { createContext } from "react";
import type { progressSummary } from "@/components/progress/level";

/**
 * What the progress cards show: the learner's growth with their tally, their
 * week, the global leaderboard, and the name of their profile. A page builds
 * it once from its own reads, so the home and try-out panes share the same cards.
 */
export function progressOf(value: {
  readonly growth: ReturnType<typeof progressSummary>;
  readonly leaders: readonly (typeof Leader.Type)[];
  /** The learner's own profile name, where See all leads; none for an account without one. */
  readonly username: Option.Option<string>;
  readonly week: typeof Week.Type | undefined;
}) {
  return value;
}

/** The progress of the page, which every progress card reads. */
export const ProgressContext = createContext<ReturnType<
  typeof progressOf
> | null>(null);

/** The progress of the page around the caller. */
export function useProgress() {
  return useRequired(ProgressContext, "useProgress");
}
