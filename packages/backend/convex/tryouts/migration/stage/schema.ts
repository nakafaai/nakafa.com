import { type Infer, v } from "convex/values";

/** One validated source-to-target staging entry. */
export const mapInputValidator = v.object({
  artifactJson: v.optional(v.string()),
  identity: v.string(),
  index: v.number(),
  kind: v.union(
    v.literal("artifact"),
    v.literal("catalog"),
    v.literal("placement")
  ),
  newHash: v.string(),
  oldHash: v.string(),
  rowJson: v.optional(v.string()),
});

/** Validated source-to-target staging input. */
export type MapInput = Infer<typeof mapInputValidator>;

/** Created and reused counts for one idempotent staging batch. */
export const simpleStageReceiptValidator = v.object({
  created: v.number(),
  unchanged: v.number(),
});

/** Permanent bundle identity plus idempotent staging counts. */
export const bundleStageReceiptValidator = v.object({
  bundleHash: v.string(),
  created: v.number(),
  rendererManifestHash: v.string(),
  snapshotId: v.string(),
  unchanged: v.number(),
});

/** Target snapshot identity plus idempotent staging counts. */
export const snapshotStageReceiptValidator = v.object({
  created: v.number(),
  snapshotId: v.string(),
  unchanged: v.number(),
});
