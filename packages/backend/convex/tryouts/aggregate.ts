import { TableAggregate } from "@convex-dev/aggregate";
import { components } from "@repo/backend/convex/_generated/api";
import type { DataModel, Id } from "@repo/backend/convex/_generated/dataModel";

export const tryoutLeaderboard = new TableAggregate<{
  Namespace: Id<"tryouts">;
  Key: [number, Id<"users">];
  DataModel: DataModel;
  TableName: "tryoutLeaderboardEntries";
}>(components.tryoutLeaderboard, {
  namespace: (doc) => doc.tryoutId,
  sortKey: (doc) => [-doc.theta, doc.userId],
});

export const globalLeaderboard = new TableAggregate<{
  Namespace: string;
  Key: [number, Id<"users">];
  DataModel: DataModel;
  TableName: "userTryoutStats";
}>(components.globalLeaderboard, {
  namespace: (doc) => doc.leaderboardNamespace,
  sortKey: (doc) => [-doc.averageTheta, doc.userId],
});
