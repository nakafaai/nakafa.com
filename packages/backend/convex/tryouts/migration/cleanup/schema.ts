import { type Infer, v } from "convex/values";

export const cleanupKinds = [
  "scaleItem",
  "scaleRun",
  "scale",
  "history",
  "catalog",
  "placement",
  "legacy",
  "runtime",
  "snapshot",
  "artifact",
  "catalogMap",
  "placementMap",
  "scaleMap",
  "audit",
] as const;

export const cleanupKindValidator = v.union(
  v.literal("scaleItem"),
  v.literal("scaleRun"),
  v.literal("scale"),
  v.literal("history"),
  v.literal("catalog"),
  v.literal("placement"),
  v.literal("legacy"),
  v.literal("runtime"),
  v.literal("snapshot"),
  v.literal("audit"),
  v.literal("artifact"),
  v.literal("catalogMap"),
  v.literal("placementMap"),
  v.literal("scaleMap")
);

export const cleanupProofValidator = v.object({
  assetHash: v.string(),
  sourceSha: v.string(),
});

export const cleanupRepairValidator = v.object({
  deletedRows: v.number(),
  itemCount: v.number(),
  migrationId: v.string(),
  planHash: v.string(),
  publishedAt: v.number(),
  questionCount: v.number(),
  repairedAt: v.number(),
  runCount: v.number(),
  runs: v.array(
    v.object({
      questionCount: v.number(),
      sectionIdentity: v.string(),
    })
  ),
  scaleVersionId: v.string(),
  setIdentity: v.string(),
  sourceSnapshotId: v.string(),
});

export const cleanupCountsValidator = v.object({
  artifact: v.number(),
  audit: v.number(),
  catalog: v.number(),
  catalogMap: v.number(),
  history: v.number(),
  legacy: v.number(),
  placement: v.number(),
  placementMap: v.number(),
  runtime: v.number(),
  scale: v.number(),
  scaleItem: v.number(),
  scaleMap: v.number(),
  scaleRun: v.number(),
  snapshot: v.number(),
});

export const cleanupStateValidator = v.object({
  counts: cleanupCountsValidator,
  kind: cleanupKindValidator,
  startedAt: v.number(),
});

export type CleanupKind = Infer<typeof cleanupKindValidator>;
export type CleanupProof = Infer<typeof cleanupProofValidator>;
export type CleanupRepair = Infer<typeof cleanupRepairValidator>;
export type CleanupState = Infer<typeof cleanupStateValidator>;

/** One bounded deletion page attributed to its signed source category. */
export interface CleanupPage {
  readonly deleted: number;
  readonly kind: CleanupKind;
}
