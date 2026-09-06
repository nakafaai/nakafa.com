import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { buildMetricsBatch } from "@repo/backend/convex/contents/metrics/batch";
import { applyPopularityCounter } from "@repo/backend/convex/contents/metrics/counter";
import { applyPopularitySignal } from "@repo/backend/convex/contents/metrics/signal";
import { Effect } from "effect";

/** Folds queued unique views into derived popularity tables. */
export const applyContentAnalyticsBatch = Effect.fn(
  "contents.metrics.applyContentAnalyticsBatch"
)(function* (
  ctx: MutationCtx,
  {
    queueItems,
    updatedAt,
  }: {
    readonly queueItems: readonly Doc<"learningEngagementQueue">[];
    readonly updatedAt: number;
  }
) {
  const batch = buildMetricsBatch({ queueItems, updatedAt });

  for (const signal of batch.signals.values()) {
    yield* applyPopularitySignal(ctx, { ...signal, updatedAt });
  }

  for (const counter of batch.counters.values()) {
    yield* applyPopularityCounter(ctx, { ...counter, updatedAt });
  }
});
