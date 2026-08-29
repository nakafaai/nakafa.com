import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import {
  type ModelMigrationTable,
  modelMigrationPhaseValidator,
  modelMigrationTableValidator,
} from "@repo/backend/convex/contentRelease/models/schema";
import type { Infer } from "convex/values";
import { v } from "convex/values";

export const MODEL_MIGRATION_PAGE_ROWS = 64;
export const MODEL_MIGRATION_PAGE_BYTES = 512 * 1024;
export const MODEL_MIGRATION_RUN_PAGES = 8;
export const FIRST_MODEL_TABLE = "articleCatalog" satisfies ModelMigrationTable;

export const modelMigrationReceiptValidator = v.object({
  complete: v.boolean(),
  phase: modelMigrationPhaseValidator,
  scannedRows: v.number(),
  table: modelMigrationTableValidator,
});

export const modelMigrationStatusValidator = v.union(
  v.object({ phase: v.literal("absent") }),
  modelMigrationReceiptValidator
);

export type ModelMigrationReceipt = Infer<
  typeof modelMigrationReceiptValidator
>;

export type ModelMigrationCycle = Omit<
  Doc<"contentModelMigrations">,
  "_creationTime"
>;
