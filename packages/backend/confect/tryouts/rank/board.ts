import { TableAggregate } from "@convex-dev/aggregate";
import { components } from "@repo/backend/convex/_generated/api";
import type { DataModel } from "@repo/backend/convex/_generated/dataModel";

/**
 * The leaderboard of every try-out set: each learner's best score on the set, highest first. The
 * namespace is the set, so a set's board never reads another's, and the key is the negated score, so
 * the board counts the learners above a score in one read and ties fall to the row's ID.
 */
export const setRanks = new TableAggregate<{
  DataModel: DataModel;
  Key: number;
  Namespace: string;
  TableName: "tryoutSetBests";
}>(components.tryoutSetRanks, {
  namespace: (best) => best.setIdentity,
  sortKey: (best) => -best.publishedScore,
});
