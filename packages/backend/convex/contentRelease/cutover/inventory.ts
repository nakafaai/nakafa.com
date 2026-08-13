import type { TableNames } from "@repo/backend/convex/_generated/dataModel";
import { retainedTryoutHistoryPlan } from "@repo/backend/convex/tryouts/history/spec";

export const CUTOVER_INVENTORY_VERSION = "production-2026-08-13" as const;
export const AUDITED_ACTIVE_RELEASE_ID =
  "full-corpus-runtime-v011-20260809-16a7436";
export const AUDITED_AUDIO_WORKFLOW_NAME =
  "audioStudies/workflows:generateAudioForQueueItem";
export const AUDITED_AUDIO_WORKFLOW_COUNT = 63;
export const AUDITED_AUDIO_WORKFLOW_SUCCESS_COUNT = 37;
export const AUDITED_AUDIO_WORKFLOW_FAILURE_COUNT = 26;
export const AUDITED_AUDIO_WORKFLOW_STEP_COUNT = 315;
export const RETAINED_TRYOUT_SNAPSHOT_ID = retainedTryoutHistoryPlan.snapshotId;
export const RETAINED_TRYOUT_RELEASES = retainedTryoutHistoryPlan.releases;

export const RETAINED_ATTEMPT_COUNT = retainedTryoutHistoryPlan.attemptCount;
export const RETAINED_CATALOG_COUNT = retainedTryoutHistoryPlan.catalogRowCount;
export const RETAINED_PLACEMENT_COUNT =
  retainedTryoutHistoryPlan.placementRowCount;
export const RETAINED_ARTIFACT_COUNT = retainedTryoutHistoryPlan.artifactCount;
export const RETAINED_FROZEN_PLACEMENT_COUNT =
  retainedTryoutHistoryPlan.frozenPlacementCount;
export const RETAINED_PROGRESS_COUNT = retainedTryoutHistoryPlan.progressCount;
export const AUDITED_CONTENT_RELEASE_COUNT = 26;
export const AUDITED_ARTICLE_COUNT = 14;
export const AUDITED_QURAN_SEARCH_COUNT = 228;
export const AUDITED_TRYOUT_CATALOG_COUNT = 108;

export interface InventoryEntry<TableName extends TableNames = TableNames> {
  readonly batchSize: number;
  readonly expected: number;
  readonly table: TableName;
}

/** Exact legacy production inventory measured immediately before Phase 1. */
export const LEGACY_INVENTORY = [
  { batchSize: 50, expected: 232, table: "articleReferences" },
  { batchSize: 50, expected: 780, table: "contentAuthors" },
  { batchSize: 4, expected: 14, table: "articleContents" },
  { batchSize: 50, expected: 2, table: "authors" },
  { batchSize: 20, expected: 766, table: "curriculumLessons" },
  { batchSize: 50, expected: 72, table: "curriculumTopics" },
  { batchSize: 50, expected: 6236, table: "quranVerses" },
  { batchSize: 50, expected: 114, table: "quranSurahs" },
  { batchSize: 50, expected: 1128, table: "contentRoutes" },
  { batchSize: 20, expected: 18, table: "contentRoutePages" },
  { batchSize: 50, expected: 8, table: "contentRouteCounts" },
  { batchSize: 50, expected: 2, table: "publicRouteSitemapCounts" },
  { batchSize: 20, expected: 2, table: "publicRouteSitemapPages" },
  { batchSize: 50, expected: 1230, table: "publicRoutes" },
  { batchSize: 50, expected: 1194, table: "publicRouteSyncState" },
  { batchSize: 8, expected: 1056, table: "contentSearch" },
] as const satisfies readonly InventoryEntry[];

/** Exact mutable signed-store inventory measured before the freeze. */
export const CURRENT_INVENTORY = [
  { batchSize: 50, expected: 4140, table: "contentKeys" },
  { batchSize: 50, expected: 780, table: "contentPaths" },
  { batchSize: 8, expected: 4206, table: "contentHeads" },
  { batchSize: 20, expected: 780, table: "contentIndex" },
  {
    batchSize: 50,
    expected: AUDITED_ARTICLE_COUNT,
    table: "articleCatalog",
  },
  { batchSize: 50, expected: 2, table: "articleCategories" },
  { batchSize: 50, expected: 14, table: "articleBuckets" },
  { batchSize: 8, expected: 766, table: "materialCatalog" },
  { batchSize: 50, expected: 745, table: "materialBuckets" },
  { batchSize: 20, expected: 840, table: "contentBindings" },
  {
    batchSize: 8,
    expected: AUDITED_CONTENT_RELEASE_COUNT,
    table: "contentReleases",
  },
  { batchSize: 8, expected: 4206, table: "contentItems" },
  { batchSize: 50, expected: 62, table: "snapshotBatches" },
  { batchSize: 20, expected: 6, table: "programCatalog" },
  { batchSize: 20, expected: 390, table: "curriculumRoutes" },
  { batchSize: 50, expected: 52, table: "programBuckets" },
  { batchSize: 20, expected: 1428, table: "quranRows" },
  {
    batchSize: 20,
    expected: AUDITED_QURAN_SEARCH_COUNT,
    table: "quranSearch",
  },
  {
    batchSize: 20,
    expected: AUDITED_TRYOUT_CATALOG_COUNT,
    table: "tryoutCatalog",
  },
  { batchSize: 20, expected: 1680, table: "tryoutPlacements" },
  { batchSize: 50, expected: 18, table: "contentOwners" },
  { batchSize: 50, expected: 0, table: "materialOwners" },
] as const satisfies readonly InventoryEntry[];

export const RETENTION_INVENTORY = [
  { batchSize: 4, expected: 4140, table: "contentArtifacts" },
  { batchSize: 4, expected: 4, table: "contentSnapshots" },
  { batchSize: 2, expected: 2, table: "tryoutBundles" },
  { batchSize: 2, expected: 1, table: "contentState" },
] as const satisfies readonly InventoryEntry[];

export const AUDIT_INVENTORY = [
  ...LEGACY_INVENTORY,
  ...CURRENT_INVENTORY,
  ...RETENTION_INVENTORY,
] as const;

export const EXPECTED_LEGACY_DELETIONS = LEGACY_INVENTORY.reduce(
  (total, entry) => total + entry.expected,
  0
);
export const EXPECTED_CURRENT_DELETIONS =
  CURRENT_INVENTORY.reduce((total, entry) => total + entry.expected, 0) +
  (RETENTION_INVENTORY[0].expected - RETAINED_ARTIFACT_COUNT) +
  (RETENTION_INVENTORY[1].expected - 1);

export type AuditTableName = (typeof AUDIT_INVENTORY)[number]["table"];
export type LegacyTableName = (typeof LEGACY_INVENTORY)[number]["table"];
export type CurrentTableName = (typeof CURRENT_INVENTORY)[number]["table"];

export const CUTOVER_ACTION_PAGE_LIMIT = 64;
export const CUTOVER_AUDIT_PAGE_SIZE = 128;
export const CUTOVER_AUDIT_PAGE_BYTES = 2 * 1024 * 1024;
