import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import {
  getPopularitySignalDay,
  isFinitePopularityWindow,
  isPopularitySignalInWindow,
  type LearningPopularityWindow,
  learningPopularityWindowValues,
} from "@repo/backend/convex/contents/popularity";

type QueuedLearningEngagement = Doc<"learningEngagementQueue">;
type AnalyticsGraphRef = Pick<
  QueuedLearningEngagement,
  | "alignmentId"
  | "assetId"
  | "conceptId"
  | "content_id"
  | "learningObjectId"
  | "lensId"
>;

/** Extracts persisted graph identity fields from one queued content view. */
function getAnalyticsGraphRef(
  item: QueuedLearningEngagement
): AnalyticsGraphRef {
  return {
    alignmentId: item.alignmentId,
    assetId: item.assetId,
    conceptId: item.conceptId,
    content_id: item.content_id,
    learningObjectId: item.learningObjectId,
    lensId: item.lensId,
  };
}

/** Extracts verified learning-context storage fields from one queued view. */
function getAnalyticsContext(item: QueuedLearningEngagement) {
  return {
    contextKey: item.contextKey,
    contextMaterialKey: item.contextMaterialKey,
    contextMode: item.contextMode,
    contextNodeKey: item.contextNodeKey,
    contextParentPath: item.contextParentPath,
    contextProgramKey: item.contextProgramKey,
    contextPublicPath: item.contextPublicPath,
    contextSourcePath: item.contextSourcePath,
  };
}

/** Encodes one metrics identity without delimiter collisions. */
function encodeMetricsKey(parts: readonly (number | string)[]) {
  return JSON.stringify(parts);
}

/**
 * Groups one queue page by popularity identity while bounding each atomic unit.
 * Map insertion order preserves the first queued occurrence of every identity.
 */
export function groupMetricsQueueItems(
  queueItems: readonly QueuedLearningEngagement[],
  groupSize: number
) {
  const identities = new Map<string, QueuedLearningEngagement[][]>();

  for (const queueItem of queueItems) {
    const key = encodeMetricsKey([
      queueItem.partition,
      queueItem.scopeMode,
      queueItem.content_id,
      queueItem.contextKey,
    ]);
    const groups = identities.get(key) ?? [];
    const current = groups.at(-1);

    if (current && current.length < groupSize) {
      current.push(queueItem);
    } else {
      groups.push([queueItem]);
    }
    identities.set(key, groups);
  }

  return [...identities.values()].flat();
}

/** Creates the first aggregate row for one queued engagement item. */
function createAnalyticsCount(item: QueuedLearningEngagement) {
  return {
    context: getAnalyticsContext(item),
    description: item.description,
    locale: item.locale,
    materialDomain: item.materialDomain,
    ref: getAnalyticsGraphRef(item),
    route: item.route,
    section: item.section,
    scopeMode: item.scopeMode,
    sourcePath: item.sourcePath,
    title: item.title,
    viewCount: 1,
  };
}

/** Creates the first daily popularity signal delta for one queued view. */
function createPopularitySignalDelta(item: QueuedLearningEngagement) {
  return {
    ...createAnalyticsCount(item),
    signalDay: getPopularitySignalDay(item.viewedAt),
  };
}

/** Creates the first configured-window counter delta for one queued view. */
function createPopularityCounterDelta(
  item: QueuedLearningEngagement,
  windowKey: LearningPopularityWindow
) {
  return {
    ...createAnalyticsCount(item),
    latestDay: getPopularitySignalDay(item.viewedAt),
    windowKey,
  };
}

/** Returns whether one queued event should update the requested counter row. */
function shouldApplyPopularityCounterDelta({
  signalDay,
  updatedAt,
  windowKey,
}: {
  readonly signalDay: number;
  readonly updatedAt: number;
  readonly windowKey: LearningPopularityWindow;
}) {
  if (!isFinitePopularityWindow(windowKey)) {
    return true;
  }

  return isPopularitySignalInWindow({
    signalDay,
    timestamp: updatedAt,
    windowKey,
  });
}

/** Aggregated daily popularity signal delta derived from queued view docs. */
export type PopularitySignalDelta = ReturnType<
  typeof createPopularitySignalDelta
>;

/** Aggregated configured-window counter delta derived from queued view docs. */
export type PopularityCounterDelta = ReturnType<
  typeof createPopularityCounterDelta
>;

/** Builds one analytics batch from append-only queued unique views. */
export function buildMetricsBatch({
  queueItems,
  updatedAt,
}: {
  readonly queueItems: readonly QueuedLearningEngagement[];
  readonly updatedAt: number;
}) {
  const counters = new Map<string, PopularityCounterDelta>();
  const signals = new Map<string, PopularitySignalDelta>();

  for (const queueItem of queueItems) {
    const signalDay = getPopularitySignalDay(queueItem.viewedAt);
    const signalKey = encodeMetricsKey([
      queueItem.scopeMode,
      signalDay,
      queueItem.content_id,
      queueItem.contextKey,
    ]);
    if (
      isPopularitySignalInWindow({
        signalDay,
        timestamp: updatedAt,
        windowKey: "365d",
      })
    ) {
      const signalCount = signals.get(signalKey);

      signals.set(signalKey, {
        ...createPopularitySignalDelta(queueItem),
        viewCount: (signalCount?.viewCount ?? 0) + 1,
      });
    }

    for (const windowKey of learningPopularityWindowValues) {
      if (
        !shouldApplyPopularityCounterDelta({
          signalDay,
          updatedAt,
          windowKey,
        })
      ) {
        continue;
      }

      const counterKey = encodeMetricsKey([
        windowKey,
        queueItem.scopeMode,
        queueItem.content_id,
        queueItem.contextKey,
      ]);
      const counterCount = counters.get(counterKey);

      if (counterCount) {
        const latest =
          signalDay >= counterCount.latestDay
            ? createPopularityCounterDelta(queueItem, windowKey)
            : counterCount;
        counters.set(counterKey, {
          ...latest,
          viewCount: counterCount.viewCount + 1,
        });
      } else {
        counters.set(
          counterKey,
          createPopularityCounterDelta(queueItem, windowKey)
        );
      }
    }
  }

  return {
    counters,
    signals,
  };
}
