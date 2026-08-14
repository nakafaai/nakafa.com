import { defineTable } from "convex/server";
import { v } from "convex/values";

const historyRowFields = {
  index: v.number(),
  rowHash: v.string(),
  rowJson: v.string(),
  snapshotId: v.string(),
};

const tables = {
  /** One exact retained-history marker for every pre-cutover attempt. */
  tryoutAttemptHistory: defineTable({
    snapshotReleaseId: v.string(),
    tryoutAttemptId: v.id("tryoutAttempts"),
    tryoutSnapshotId: v.string(),
  }).index("by_tryoutAttemptId", ["tryoutAttemptId"]),

  /** Exact authenticated old row envelopes retained outside current tables. */
  tryoutHistoryRows: defineTable(
    v.union(
      v.object({
        ...historyRowFields,
        rowKind: v.literal("catalog"),
      }),
      v.object({
        ...historyRowFields,
        answerArtifactHash: v.string(),
        questionArtifactHash: v.string(),
        rowKind: v.literal("placement"),
      })
    )
  )
    .index("by_answerArtifactHash", ["answerArtifactHash"])
    .index("by_questionArtifactHash", ["questionArtifactHash"])
    .index("by_snapshotId_and_rowKind_and_index", [
      "snapshotId",
      "rowKind",
      "index",
    ])
    .index("by_snapshotId_and_rowKind_and_rowHash", [
      "snapshotId",
      "rowKind",
      "rowHash",
    ]),
};

export default tables;
