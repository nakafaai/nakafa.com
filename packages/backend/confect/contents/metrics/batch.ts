import type { Docs } from "@repo/backend/confect/_generated/docs";
import {
  getPopularitySignalDay,
  isFinitePopularityWindow,
  isPopularitySignalInWindow,
  type LearningPopularityWindow,
  learningPopularityWindowValues,
} from "@repo/backend/confect/contents/popularity";
import { encodeJsonText } from "@repo/utilities/json";
import { Array as Arr, MutableHashMap, Option, Struct } from "effect";

type QueuedLearningEngagement = Docs["learningEngagementQueue"];
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
  return Struct.pick(item, [
    "contextKey",
    "contextMaterialKey",
    "contextMode",
    "contextNodeKey",
    "contextParentPath",
    "contextProgramKey",
    "contextPublicPath",
    "contextSourcePath",
  ]);
}

/** Encodes one metrics identity without delimiter collisions. */
function encodeMetricsKey(parts: readonly (number | string)[]) {
  return encodeJsonText(parts);
}

/**
 * Groups one queue page by popularity identity while bounding each atomic unit.
 * Map insertion order preserves the first queued occurrence of every identity.
 */
export function groupMetricsQueueItems(
  queueItems: readonly QueuedLearningEngagement[],
  groupSize: number
) {
  const identities = MutableHashMap.empty<
    string,
    QueuedLearningEngagement[][]
  >();
  for (const queueItem of queueItems) {
    const key = encodeMetricsKey([
      queueItem.partition,
      queueItem.scopeMode,
      queueItem.content_id,
      queueItem.contextKey,
    ]);
    const groups =
      Option.getOrUndefined(MutableHashMap.get(identities, key)) ?? [];
    const current = groups.at(-1);
    MutableHashMap.set(
      identities,
      key,
      current && current.length < groupSize
        ? Arr.append(Arr.dropRight(groups, 1), Arr.append(current, queueItem))
        : Arr.append(groups, [queueItem])
    );
  }
  return Arr.flatten([...MutableHashMap.values(identities)]);
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
  const counters = MutableHashMap.empty<string, PopularityCounterDelta>();
  const signals = MutableHashMap.empty<string, PopularitySignalDelta>();
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
      const signalCount = Option.getOrUndefined(
        MutableHashMap.get(signals, signalKey)
      );
      MutableHashMap.set(signals, signalKey, {
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
      const counterCount = Option.getOrUndefined(
        MutableHashMap.get(counters, counterKey)
      );
      if (counterCount) {
        const latest =
          signalDay >= counterCount.latestDay
            ? createPopularityCounterDelta(queueItem, windowKey)
            : counterCount;
        MutableHashMap.set(counters, counterKey, {
          ...latest,
          viewCount: counterCount.viewCount + 1,
        });
      } else {
        MutableHashMap.set(
          counters,
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
