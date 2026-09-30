import { describe, expect, it } from "@effect/vitest";
import { ACTIVE_APP_LOCALE_CODES } from "@nakafa/aksara-contracts/locale";
import {
  ARTICLE_VALIDATION_CLAIM_READ_LIMIT,
  ARTICLE_VALIDATION_SCAN_LIMIT,
} from "@repo/backend/confect/contentRelease/article/limits";
import { CONTENT_BUCKET_SIZE } from "@repo/backend/confect/contentRelease/bucket";
import {
  CONTENT_DOCUMENT_LIMIT,
  READ_MODEL_DOCUMENT_LIMIT,
  SEARCH_DOCUMENT_LIMIT,
} from "@repo/backend/confect/contentRelease/document";
import {
  PAGE_CATALOG_LIMIT,
  PAGE_IDENTITY_READ_LIMIT,
  PAGE_OWNER_READ_LIMIT,
} from "@repo/backend/confect/contentRelease/page/limits";
import { PROJECTION_PAGE_LIMIT } from "@repo/backend/confect/contentRelease/paging";
import {
  PROGRAM_ANCESTOR_LIMIT,
  PROGRAM_CATALOG_LIMIT,
  PROGRAM_MATERIAL_LIMIT,
  PROGRAM_RELATED_LIMIT,
} from "@repo/backend/confect/contentRelease/program/limits";
import {
  ARTIFACT_PAGE_COUNT,
  COMPACTION_HEAD_COUNT,
  COMPACTION_ITEM_COUNT,
  COMPACTION_PAGE_BYTES,
  RELEASE_PAGE_LIMIT,
  TRANSACTION_READ_HEADROOM,
  TRANSACTION_READ_LIMIT,
} from "@repo/backend/confect/contentRelease/spec";
import { TRYOUT_PLACEMENT_DOCUMENT_LIMIT } from "@repo/backend/confect/contentRelease/tryout/limits";

describe("contentRelease/spec", () => {
  it("preserves four MiB around worst-case lifecycle pages", () => {
    const maximumPageBytes =
      RELEASE_PAGE_LIMIT *
      (2 * CONTENT_DOCUMENT_LIMIT + 5 * READ_MODEL_DOCUMENT_LIMIT);

    expect(maximumPageBytes).toBeLessThanOrEqual(
      TRANSACTION_READ_LIMIT - TRANSACTION_READ_HEADROOM
    );
  });

  it("bounds maintenance pages below the transaction read budget", () => {
    // Proving one artifact referenced reads one head, one release item, and
    // the try-out placements naming it as question and answer. An
    // unreferenced artifact reads only its small facts instead.
    const referenceBytes =
      READ_MODEL_DOCUMENT_LIMIT +
      CONTENT_DOCUMENT_LIMIT +
      2 * TRYOUT_PLACEMENT_DOCUMENT_LIMIT;
    // Artifact facts hold fixed-size identities, far below a read model.
    const factsBytes = READ_MODEL_DOCUMENT_LIMIT;
    const maximumHeadWork =
      COMPACTION_HEAD_COUNT *
      (7 * READ_MODEL_DOCUMENT_LIMIT + 2 * referenceBytes);
    const maximumItemWork =
      2 * (COMPACTION_PAGE_BYTES + CONTENT_DOCUMENT_LIMIT) +
      COMPACTION_ITEM_COUNT * referenceBytes;
    const maximumArtifactWork =
      ARTIFACT_PAGE_COUNT *
      (factsBytes +
        Math.max(referenceBytes, CONTENT_DOCUMENT_LIMIT + factsBytes));
    // Cleanup reads and then patches its release beside the facts page.
    const maximumCleanupWork = 4 * CONTENT_DOCUMENT_LIMIT + maximumArtifactWork;
    const maximumSearchWork =
      CONTENT_DOCUMENT_LIMIT +
      PROJECTION_PAGE_LIMIT *
        (SEARCH_DOCUMENT_LIMIT + 4 * READ_MODEL_DOCUMENT_LIMIT);

    expect(maximumHeadWork).toBeLessThanOrEqual(
      TRANSACTION_READ_LIMIT - TRANSACTION_READ_HEADROOM
    );
    expect(maximumItemWork).toBeLessThanOrEqual(
      TRANSACTION_READ_LIMIT - TRANSACTION_READ_HEADROOM
    );
    expect(maximumArtifactWork).toBeLessThanOrEqual(
      TRANSACTION_READ_LIMIT - TRANSACTION_READ_HEADROOM
    );
    expect(maximumCleanupWork).toBeLessThanOrEqual(
      TRANSACTION_READ_LIMIT - TRANSACTION_READ_HEADROOM
    );
    expect(maximumSearchWork).toBeLessThanOrEqual(
      TRANSACTION_READ_LIMIT - TRANSACTION_READ_HEADROOM
    );
  });

  it("bounds article partitions by their worst-case verified reads", () => {
    const maximumArticleWork =
      CONTENT_BUCKET_SIZE * 6 * READ_MODEL_DOCUMENT_LIMIT;

    expect(maximumArticleWork).toBeLessThanOrEqual(
      TRANSACTION_READ_LIMIT - TRANSACTION_READ_HEADROOM
    );
  });

  it("bounds final article validation by its page and category reads", () => {
    const maximumWork =
      CONTENT_DOCUMENT_LIMIT +
      (ARTICLE_VALIDATION_SCAN_LIMIT +
        ARTICLE_VALIDATION_CLAIM_READ_LIMIT +
        2) *
        READ_MODEL_DOCUMENT_LIMIT;
    expect(maximumWork).toBeLessThanOrEqual(
      TRANSACTION_READ_LIMIT - TRANSACTION_READ_HEADROOM
    );
  });

  it("bounds the complete locale-equivalent Page catalog", () => {
    const ownerBytes = PAGE_OWNER_READ_LIMIT * CONTENT_DOCUMENT_LIMIT;
    const localeCount = ACTIVE_APP_LOCALE_CODES.length;
    const sentinelRows = localeCount;
    const identityRows =
      localeCount * PAGE_CATALOG_LIMIT * PAGE_IDENTITY_READ_LIMIT;
    const maximumPageWork =
      ownerBytes + (sentinelRows + identityRows) * READ_MODEL_DOCUMENT_LIMIT;

    expect(PAGE_CATALOG_LIMIT).toBeGreaterThan(0);
    expect(maximumPageWork).toBeLessThanOrEqual(
      TRANSACTION_READ_LIMIT - TRANSACTION_READ_HEADROOM
    );
  });

  it("bounds complete program reads by document size and row count", () => {
    const ownerBytes = 3 * CONTENT_DOCUMENT_LIMIT;
    const maximumCatalogRows = 2 * (PROGRAM_CATALOG_LIMIT + 1);
    const routeAndProgramRows = 2;
    const alternateRows = 2;
    const relationshipRows = 2 * (PROGRAM_RELATED_LIMIT + 1);
    const groupRows = PROGRAM_RELATED_LIMIT;
    const materialRows = PROGRAM_MATERIAL_LIMIT + 1;
    const maximumRouteRows =
      routeAndProgramRows +
      alternateRows +
      PROGRAM_ANCESTOR_LIMIT +
      relationshipRows +
      groupRows +
      materialRows;
    const maximumCatalogWork =
      ownerBytes + maximumCatalogRows * READ_MODEL_DOCUMENT_LIMIT;
    const maximumRouteWork =
      ownerBytes + maximumRouteRows * READ_MODEL_DOCUMENT_LIMIT;

    expect(maximumCatalogWork).toBeLessThanOrEqual(
      TRANSACTION_READ_LIMIT - TRANSACTION_READ_HEADROOM
    );
    expect(maximumRouteWork).toBeLessThanOrEqual(
      TRANSACTION_READ_LIMIT - TRANSACTION_READ_HEADROOM
    );
  });
});
