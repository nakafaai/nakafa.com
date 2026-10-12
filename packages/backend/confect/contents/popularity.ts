import type { ContentViewer } from "@repo/backend/confect/contents/views/viewer";

// Stored scope vocabulary. The pipeline writes only the global scope now, but a
// daily signal, a viewer key or a queued view written before it narrowed may
// still hold "placement" until it ages out (ADR 0008), so the vocabulary stays
// until then.
export const learningPopularityScopeValues = ["global", "placement"] as const;
type LearningPopularityScope = (typeof learningPopularityScopeValues)[number];

/** Milliseconds in one UTC popularity signal day. */
export const POPULARITY_DAY_MS = 24 * 60 * 60 * 1000;

/** Returns the UTC day bucket that owns one engagement timestamp. */
export function getPopularitySignalDay(timestamp: number) {
  return Math.floor(timestamp / POPULARITY_DAY_MS) * POPULARITY_DAY_MS;
}

/** Returns the stable popularity identity for one viewer event. */
export function createPopularityViewerKey(viewer: ContentViewer) {
  if (viewer.kind === "account") {
    return `user:${viewer.userId}`;
  }
  return `device:${viewer.deviceId}`;
}

/**
 * The one window, scope and section the pipeline maintains: the homepage
 * trending list reads exactly this ranking and nothing else. The window is the
 * last seven UTC signal days, the current day included.
 */
export const POPULARITY_WINDOW_DAYS = 7;
export const POPULARITY_WINDOW = `${POPULARITY_WINDOW_DAYS}d` as const;
export const POPULARITY_SCOPE =
  "global" as const satisfies LearningPopularityScope;
export const POPULARITY_SECTION = "material" as const;

/** Whether one view counts toward the ranking the homepage reads. */
export function isRankedPopularityView(view: {
  readonly scopeMode: LearningPopularityScope;
  readonly section: string;
}) {
  return (
    view.scopeMode === POPULARITY_SCOPE && view.section === POPULARITY_SECTION
  );
}

/**
 * Returns the first UTC signal day the window includes at a given refresh
 * time.
 */
export function getPopularityWindowStartDay(timestamp: number) {
  return (
    getPopularitySignalDay(timestamp) -
    (POPULARITY_WINDOW_DAYS - 1) * POPULARITY_DAY_MS
  );
}

/** Returns whether a daily signal belongs to the window at refresh time. */
export function isPopularitySignalInWindow({
  signalDay,
  timestamp,
}: {
  readonly signalDay: number;
  readonly timestamp: number;
}) {
  return (
    signalDay >= getPopularityWindowStartDay(timestamp) &&
    signalDay <= getPopularitySignalDay(timestamp)
  );
}
