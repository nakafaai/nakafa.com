import { defineTable } from "convex/server";
import type { Infer } from "convex/values";
import { v } from "convex/values";

export const modelMigrationTableValidator = v.union(
  v.literal("articleCatalog"),
  v.literal("articleCategories"),
  v.literal("articleBuckets"),
  v.literal("materialCatalog"),
  v.literal("materialBuckets"),
  v.literal("contentIndex"),
  v.literal("contentReleases")
);

export type ModelMigrationTable = Infer<typeof modelMigrationTableValidator>;

export const modelMigrationPhaseValidator = v.union(
  v.literal("backfill"),
  v.literal("verify"),
  v.literal("complete")
);

const tables = {
  /** One temporary crash-safe expansion cycle for the bounded model buffers. */
  contentModelMigrations: defineTable({
    activeManifestHash: v.string(),
    activeReleaseId: v.string(),
    activeSequence: v.number(),
    cursor: v.optional(v.string()),
    key: v.literal("primary"),
    phase: modelMigrationPhaseValidator,
    scannedRows: v.number(),
    table: modelMigrationTableValidator,
    updatedAt: v.number(),
  }).index("by_key", ["key"]),
};

export default tables;
