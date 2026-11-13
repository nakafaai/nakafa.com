import type { Leader, Week } from "@repo/backend/confect/island/view";
import { createContext, use } from "react";
import type { entryOf } from "@/lib/island/entry";

/**
 * What the progress cards show (the owner's home sketch, 13 Nov): the
 * learner's island with its badges, their week, and the global leaderboard. A
 * page builds it once from its own reads, so the home and the try-out panes
 * show the same cards.
 */
export function progressOf(value: {
  readonly island: ReturnType<typeof entryOf>;
  readonly leaders: readonly (typeof Leader.Type)[];
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
  const progress = use(ProgressContext);
  if (progress === null) {
    throw new Error("useProgress must be used within ProgressContext");
  }
  return progress;
}
