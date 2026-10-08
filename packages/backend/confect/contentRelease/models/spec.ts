import { GenericId } from "@confect/core";
import { modelSlotValidator } from "@repo/backend/confect/contentRelease/models/slot";
import { Schema } from "effect";
export const MODEL_BUILD_PAGE_ROWS = 32;
export const MODEL_BUILD_PAGE_BYTES = 512 * 1024;
const modelBuildPageValidator = Schema.Struct({
  cursor: Schema.optional(Schema.String),
  done: Schema.Boolean,
  itemIndex: Schema.optionalKey(Schema.Finite),
  processed: Schema.Finite,
});
export type ModelBuildPage = typeof modelBuildPageValidator.Type;
export const modelBuildPhaseValidator = Schema.Union([
  Schema.Literal("articleCatalog"),
  Schema.Literal("articleCategories"),
  Schema.Literal("articleBuckets"),
  Schema.Literal("articleApply"),
  Schema.Literal("articleVerify"),
  Schema.Literal("materialCatalog"),
  Schema.Literal("materialBuckets"),
  Schema.Literal("materialApply"),
  Schema.Literal("materialVerify"),
  Schema.Literal("search"),
  Schema.Literal("searchApply"),
  Schema.Literal("searchVerify"),
  Schema.Literal("ready"),
]);
export type ModelBuildPhase = typeof modelBuildPhaseValidator.Type;
export const modelBuildBaseValidator = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal("empty"),
  }),
  Schema.Struct({
    kind: Schema.Literal("release"),
    manifestHash: Schema.String,
    releaseId: Schema.String,
    sequence: Schema.Finite,
  }),
]);
export const modelBuildStatusValidator = Schema.Union([
  Schema.Struct({
    phase: Schema.Literal("completed"),
    releaseId: Schema.String,
  }),
  Schema.Struct({
    phase: Schema.Literal("ready"),
    releaseId: Schema.String,
  }),
  Schema.Struct({
    phase: Schema.Union([Schema.Literal("building"), Schema.Literal("failed")]),
    releaseId: Schema.String,
    syncGeneration: Schema.Finite,
    syncJobId: GenericId.GenericId("_scheduled_functions"),
  }),
]);
export type ModelBuildStatus = typeof modelBuildStatusValidator.Type;
export const modelBuildRestartArgsValidator = Schema.Struct({
  expectedGeneration: Schema.Finite,
  expectedJobId: GenericId.GenericId("_scheduled_functions"),
  releaseId: Schema.String,
});
export type ModelBuildRestartArgs = typeof modelBuildRestartArgsValidator.Type;
export const modelBuildRestartResultValidator = Schema.Union([
  Schema.Struct({
    status: Schema.Literal("restarted"),
    syncGeneration: Schema.Finite,
    syncJobId: GenericId.GenericId("_scheduled_functions"),
  }),
  Schema.Struct({
    status: Schema.Literal("stale"),
  }),
]);
export type ModelBuildRestartResult =
  typeof modelBuildRestartResultValidator.Type;
export const modelBuildSlotsValidator = Schema.Struct({
  articleBaseSlot: modelSlotValidator,
  articleTargetSlot: modelSlotValidator,
  materialBaseSlot: modelSlotValidator,
  materialTargetSlot: modelSlotValidator,
  searchBaseSlot: modelSlotValidator,
  searchTargetSlot: modelSlotValidator,
});
