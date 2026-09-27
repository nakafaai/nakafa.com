import type { Docs } from "@repo/backend/confect/_generated/docs";
import { buildMetricsBatch } from "@repo/backend/confect/contents/metrics/batch";
import { applyPopularityCounter } from "@repo/backend/confect/contents/metrics/counter";
import { applyPopularitySignal } from "@repo/backend/confect/contents/metrics/signal";
import { Effect } from "effect";

/** Folds queued unique views into derived popularity tables. */
export const applyContentAnalyticsBatch = Effect.fn(
  "contents.metrics.applyContentAnalyticsBatch"
)(function* ({
  queueItems,
  updatedAt,
}: {
  readonly queueItems: readonly Docs["learningEngagementQueue"][];
  readonly updatedAt: number;
}) {
  const batch = buildMetricsBatch({
    queueItems,
    updatedAt,
  });
  for (const signal of batch.signals.values()) {
    yield* applyPopularitySignal({
      ...signal,
      updatedAt,
    });
  }
  for (const counter of batch.counters.values()) {
    yield* applyPopularityCounter({
      ...counter,
      updatedAt,
    });
  }
});
