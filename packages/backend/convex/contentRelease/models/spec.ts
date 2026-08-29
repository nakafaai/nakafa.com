import { modelSlotValidator } from "@repo/backend/convex/contentRelease/models/slot";
import { type Infer, v } from "convex/values";

export const MODEL_BUILD_PAGE_ROWS = 32;
export const MODEL_BUILD_PAGE_BYTES = 512 * 1024;

export interface ModelBuildPage {
  readonly cursor?: string;
  readonly done: boolean;
  readonly itemIndex?: number;
  readonly processed: number;
}

export const modelBuildPhaseValidator = v.union(
  v.literal("articleClearCatalog"),
  v.literal("articleClearCategories"),
  v.literal("articleClearBuckets"),
  v.literal("articleCopyCatalog"),
  v.literal("articleCopyCategories"),
  v.literal("articleCopyBuckets"),
  v.literal("articleApply"),
  v.literal("articleVerify"),
  v.literal("materialClearCatalog"),
  v.literal("materialClearBuckets"),
  v.literal("materialCopyCatalog"),
  v.literal("materialCopyBuckets"),
  v.literal("materialApply"),
  v.literal("materialVerify"),
  v.literal("searchClear"),
  v.literal("searchCopy"),
  v.literal("searchApply"),
  v.literal("searchVerify"),
  v.literal("ready")
);

export type ModelBuildPhase = Infer<typeof modelBuildPhaseValidator>;

export const modelBuildBaseValidator = v.union(
  v.object({ kind: v.literal("empty") }),
  v.object({
    kind: v.literal("release"),
    manifestHash: v.string(),
    releaseId: v.string(),
    sequence: v.number(),
  })
);

export const modelBuildStatusValidator = v.union(
  v.object({ phase: v.literal("completed"), releaseId: v.string() }),
  v.object({ phase: v.literal("ready"), releaseId: v.string() }),
  v.object({
    phase: v.union(v.literal("building"), v.literal("failed")),
    releaseId: v.string(),
    syncGeneration: v.number(),
    syncJobId: v.id("_scheduled_functions"),
  })
);
export type ModelBuildStatus = Infer<typeof modelBuildStatusValidator>;

export const modelBuildRestartArgsValidator = v.object({
  expectedGeneration: v.number(),
  expectedJobId: v.id("_scheduled_functions"),
  releaseId: v.string(),
});
export type ModelBuildRestartArgs = Infer<
  typeof modelBuildRestartArgsValidator
>;

export const modelBuildRestartResultValidator = v.union(
  v.object({
    status: v.literal("restarted"),
    syncGeneration: v.number(),
    syncJobId: v.id("_scheduled_functions"),
  }),
  v.object({ status: v.literal("stale") })
);
export type ModelBuildRestartResult = Infer<
  typeof modelBuildRestartResultValidator
>;

export const modelBuildSlotsValidator = v.object({
  articleBaseSlot: modelSlotValidator,
  articleTargetSlot: modelSlotValidator,
  materialBaseSlot: modelSlotValidator,
  materialTargetSlot: modelSlotValidator,
  searchBaseSlot: modelSlotValidator,
  searchTargetSlot: modelSlotValidator,
});
