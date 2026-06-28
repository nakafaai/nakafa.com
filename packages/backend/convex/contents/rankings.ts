import { TableAggregate } from "@convex-dev/aggregate";
import { components } from "@repo/backend/convex/_generated/api";
import type { DataModel, Doc } from "@repo/backend/convex/_generated/dataModel";

type LearningPopularityCounter = Doc<"learningPopularityCounters">;

export type LearningPopularityRankingNamespace = [
  LearningPopularityCounter["section"],
  LearningPopularityCounter["locale"],
  LearningPopularityCounter["scopeMode"],
  LearningPopularityCounter["windowKey"],
];

/**
 * Aggregate-backed ranking index for windowed learning popularity counters.
 *
 * The namespace matches the homepage access pattern exactly, so top-N reads do
 * not scan counters from other sections, locales, scopes, or windows. Negative
 * score sorts the aggregate in highest-score-first order with the content ID as
 * a stable tie breaker.
 */
export const learningPopularityRankings = new TableAggregate<{
  Namespace: LearningPopularityRankingNamespace;
  Key: [number, string];
  DataModel: DataModel;
  TableName: "learningPopularityCounters";
}>(components.learningPopularityRankings, {
  namespace: (counter) => [
    counter.section,
    counter.locale,
    counter.scopeMode,
    counter.windowKey,
  ],
  sortKey: (counter) => [-counter.score, counter.content_id],
});
