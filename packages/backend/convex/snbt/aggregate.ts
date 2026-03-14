import { TableAggregate } from "@convex-dev/aggregate";
import { components } from "@repo/backend/convex/_generated/api";
import type { DataModel, Id } from "@repo/backend/convex/_generated/dataModel";

/**
 * Aggregate for per-tryout leaderboard rankings.
 *
 * Maintains O(log n) rankings by theta within each try-out.
 * Used for: Per-tryout leaderboard, user's rank within a try-out.
 *
 * Namespace: tryoutId (separate rankings per try-out)
 * Key: [-theta, userId] (negative theta for descending order)
 */
export const tryoutLeaderboard = new TableAggregate<{
  Namespace: Id<"snbtTryouts">;
  Key: [number, Id<"users">];
  DataModel: DataModel;
  TableName: "snbtLeaderboard";
  // Note: We use snbtLeaderboard table but store per-tryout entries
}>(components.tryoutLeaderboard, {
  namespace: (doc) => doc.tryoutId,
  sortKey: (doc) => [-doc.theta, doc.userId],
});

/**
 * Aggregate for global leaderboard rankings.
 *
 * Maintains O(log n) rankings by average theta across all official try-outs in
 * the same locale and year.
 * Used for: Year-scoped global leaderboard, user's overall rank within that
 * scale family.
 *
 * Namespace: locale:year (separate rankings per locale and year)
 * Key: [-averageTheta, userId] (negative for descending order)
 */
export const globalLeaderboard = new TableAggregate<{
  Namespace: string;
  Key: [number, Id<"users">];
  DataModel: DataModel;
  TableName: "userSnbtStats";
}>(components.globalLeaderboard, {
  namespace: (doc) => `${doc.locale}:${doc.year}`,
  sortKey: (doc) => [-doc.averageTheta, doc.userId],
});
