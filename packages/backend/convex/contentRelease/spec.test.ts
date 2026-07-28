import { MAX_SIGNED_ARTIFACT_BYTES } from "@nakafa/aksara-contracts/limits";
import { CONTENT_BUCKET_SIZE } from "@repo/backend/convex/contentRelease/bucket";
import {
  CONTENT_DOCUMENT_LIMIT,
  READ_MODEL_DOCUMENT_LIMIT,
  SEARCH_DOCUMENT_LIMIT,
} from "@repo/backend/convex/contentRelease/document";
import {
  MATERIAL_BASELINE_LIMIT,
  MATERIAL_IDENTITY_READ_LIMIT,
} from "@repo/backend/convex/contentRelease/material/limits";
import { PROJECTION_PAGE_LIMIT } from "@repo/backend/convex/contentRelease/paging";
import {
  PROGRAM_ANCESTOR_LIMIT,
  PROGRAM_CATALOG_LIMIT,
  PROGRAM_MATERIAL_LIMIT,
  PROGRAM_RELATED_LIMIT,
} from "@repo/backend/convex/contentRelease/program/limits";
import {
  ARTIFACT_PAGE_BYTES,
  ARTIFACT_PAGE_COUNT,
  COMPACTION_HEAD_COUNT,
  COMPACTION_ITEM_COUNT,
  COMPACTION_PAGE_BYTES,
  RELEASE_PAGE_LIMIT,
  TRANSACTION_READ_HEADROOM,
  TRANSACTION_READ_LIMIT,
} from "@repo/backend/convex/contentRelease/spec";
import { describe, expect, it } from "vitest";

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
    const referenceBytes =
      3 * CONTENT_DOCUMENT_LIMIT + READ_MODEL_DOCUMENT_LIMIT;
    const maximumArtifactWork =
      ARTIFACT_PAGE_BYTES + ARTIFACT_PAGE_COUNT * referenceBytes;
    const maximumHeadWork =
      COMPACTION_PAGE_BYTES + COMPACTION_HEAD_COUNT * 2 * referenceBytes;
    const maximumItemWork =
      COMPACTION_PAGE_BYTES + COMPACTION_ITEM_COUNT * referenceBytes;
    const maximumSearchWork =
      CONTENT_DOCUMENT_LIMIT +
      PROJECTION_PAGE_LIMIT *
        (SEARCH_DOCUMENT_LIMIT + 4 * READ_MODEL_DOCUMENT_LIMIT);

    expect(ARTIFACT_PAGE_COUNT * MAX_SIGNED_ARTIFACT_BYTES).toBeLessThan(
      ARTIFACT_PAGE_BYTES
    );
    expect(maximumArtifactWork).toBeLessThanOrEqual(
      TRANSACTION_READ_LIMIT - TRANSACTION_READ_HEADROOM
    );
    expect(maximumHeadWork).toBeLessThanOrEqual(
      TRANSACTION_READ_LIMIT - TRANSACTION_READ_HEADROOM
    );
    expect(maximumItemWork).toBeLessThanOrEqual(
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

  it("bounds first material-model pages including integrity reads", () => {
    const ownerBytes = 2 * CONTENT_DOCUMENT_LIMIT;
    const maximumBaselineWork =
      ownerBytes +
      MATERIAL_BASELINE_LIMIT *
        MATERIAL_IDENTITY_READ_LIMIT *
        READ_MODEL_DOCUMENT_LIMIT;

    expect(maximumBaselineWork).toBeLessThanOrEqual(
      TRANSACTION_READ_LIMIT - TRANSACTION_READ_HEADROOM
    );
  });
});
