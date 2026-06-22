import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import {
  getPopularitySignalDay,
  type LearningPopularityWindow,
  learningPopularityWindowValues,
} from "@repo/backend/convex/contents/popularity";
import type { Locale } from "@repo/backend/convex/lib/validators/contents";

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

/** Aggregated graph-view delta for one content asset and locale. */
export interface AnalyticsCount {
  readonly context: Pick<
    QueuedLearningEngagement,
    | "contextKey"
    | "contextMaterialKey"
    | "contextMode"
    | "contextNodeKey"
    | "contextParentPath"
    | "contextProgramKey"
    | "contextPublicPath"
    | "contextSourcePath"
  >;
  readonly description: QueuedLearningEngagement["description"];
  readonly locale: Locale;
  readonly materialDomain: QueuedLearningEngagement["materialDomain"];
  readonly ref: AnalyticsGraphRef;
  readonly route: string;
  readonly scopeMode: QueuedLearningEngagement["scopeMode"];
  readonly section: QueuedLearningEngagement["section"];
  readonly sourcePath: string;
  readonly title: string;
  viewCount: number;
}

/** Aggregated daily popularity signal delta. */
export type PopularitySignalDelta = AnalyticsCount & {
  readonly signalDay: number;
};

/** Aggregated configured-window popularity counter delta. */
export type PopularityCounterDelta = AnalyticsCount & {
  readonly windowKey: LearningPopularityWindow;
};

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

/** Creates the first aggregate row for one queued engagement item. */
function createAnalyticsCount(item: QueuedLearningEngagement): AnalyticsCount {
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

/** Builds one analytics batch from append-only queued unique views. */
export function buildMetricsBatch(
  queueItems: readonly QueuedLearningEngagement[]
) {
  const counters = new Map<string, PopularityCounterDelta>();
  const signals = new Map<string, PopularitySignalDelta>();

  for (const queueItem of queueItems) {
    const signalDay = getPopularitySignalDay(queueItem.viewedAt);
    const signalKey = [
      queueItem.scopeMode,
      signalDay,
      queueItem.content_id,
      queueItem.contextKey,
    ].join(":");
    const signalCount = signals.get(signalKey);

    if (signalCount) {
      signalCount.viewCount += 1;
    } else {
      signals.set(signalKey, {
        ...createAnalyticsCount(queueItem),
        signalDay,
      });
    }

    for (const windowKey of learningPopularityWindowValues) {
      const counterKey = [
        windowKey,
        queueItem.scopeMode,
        queueItem.content_id,
        queueItem.contextKey,
      ].join(":");
      const counterCount = counters.get(counterKey);

      if (counterCount) {
        counterCount.viewCount += 1;
      } else {
        counters.set(counterKey, {
          ...createAnalyticsCount(queueItem),
          windowKey,
        });
      }
    }
  }

  return {
    counters,
    signals,
  };
}
