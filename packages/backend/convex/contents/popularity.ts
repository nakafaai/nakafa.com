export const learningPopularityWindowValues = [
  "1d",
  "7d",
  "14d",
  "30d",
  "90d",
  "180d",
  "365d",
  "lifetime",
] as const;

export type LearningPopularityWindow =
  (typeof learningPopularityWindowValues)[number];

export const learningPopularityScopeValues = ["global", "placement"] as const;

export type LearningPopularityScope =
  (typeof learningPopularityScopeValues)[number];

const popularityWindowDayCounts: {
  readonly [windowKey in Exclude<LearningPopularityWindow, "lifetime">]: number;
} = {
  "1d": 1,
  "7d": 7,
  "14d": 14,
  "30d": 30,
  "90d": 90,
  "180d": 180,
  "365d": 365,
};

/** Milliseconds in one UTC popularity signal day. */
export const POPULARITY_DAY_MS = 24 * 60 * 60 * 1000;

/** Returns the UTC day bucket that owns one engagement timestamp. */
export function getPopularitySignalDay(timestamp: number) {
  return Math.floor(timestamp / POPULARITY_DAY_MS) * POPULARITY_DAY_MS;
}

/** Returns the stable popularity identity for one viewer event. */
export function createPopularityViewerKey(input: {
  readonly deviceId: string;
  readonly userId?: string;
}) {
  if (input.userId) {
    return `user:${input.userId}`;
  }

  return `device:${input.deviceId}`;
}

/** Returns the default popularity window used by homepage ranked reads. */
export function getDefaultPopularityWindow(): LearningPopularityWindow {
  return "7d";
}

/** Returns the all-time popularity window used by background generation jobs. */
export function getLifetimePopularityWindow(): LearningPopularityWindow {
  return "lifetime";
}

/**
 * Narrows popularity windows to the finite windows that must expire old daily
 * signals through scheduled read-model refreshes.
 */
export function isFinitePopularityWindow(
  windowKey: LearningPopularityWindow
): windowKey is Exclude<LearningPopularityWindow, "lifetime"> {
  return windowKey !== "lifetime";
}

/** Returns the finite popularity windows maintained from daily signal rows. */
export function getFinitePopularityWindows() {
  return learningPopularityWindowValues.filter(isFinitePopularityWindow);
}

/** Returns how many UTC signal days belong to one finite popularity window. */
export function getPopularityWindowDayCount(
  windowKey: Exclude<LearningPopularityWindow, "lifetime">
) {
  return popularityWindowDayCounts[windowKey];
}

/**
 * Returns the first UTC signal day included by a finite popularity window at a
 * given refresh time.
 */
export function getPopularityWindowStartDay(
  windowKey: Exclude<LearningPopularityWindow, "lifetime">,
  timestamp: number
) {
  const currentDay = getPopularitySignalDay(timestamp);
  const dayCount = getPopularityWindowDayCount(windowKey);

  return currentDay - (dayCount - 1) * POPULARITY_DAY_MS;
}
