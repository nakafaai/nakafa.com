import { MAX_SIGNED_ARTIFACT_BYTES } from "@nakafa/aksara-contracts/limits";
import { ARTICLE_BUCKET_SIZE } from "@repo/backend/convex/contentRelease/article/bucket";
import {
  CONTENT_DOCUMENT_LIMIT,
  HEAD_DOCUMENT_LIMIT,
  SEARCH_DOCUMENT_LIMIT,
} from "@repo/backend/convex/contentRelease/document";
import { PROJECTION_PAGE_LIMIT } from "@repo/backend/convex/contentRelease/paging";
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
      (2 * CONTENT_DOCUMENT_LIMIT + 5 * HEAD_DOCUMENT_LIMIT);

    expect(maximumPageBytes).toBeLessThanOrEqual(
      TRANSACTION_READ_LIMIT - TRANSACTION_READ_HEADROOM
    );
  });

  it("bounds maintenance pages below the transaction read budget", () => {
    const referenceBytes = 3 * CONTENT_DOCUMENT_LIMIT + HEAD_DOCUMENT_LIMIT;
    const maximumArtifactWork =
      ARTIFACT_PAGE_BYTES + ARTIFACT_PAGE_COUNT * referenceBytes;
    const maximumHeadWork =
      COMPACTION_PAGE_BYTES + COMPACTION_HEAD_COUNT * 2 * referenceBytes;
    const maximumItemWork =
      COMPACTION_PAGE_BYTES + COMPACTION_ITEM_COUNT * referenceBytes;
    const maximumSearchWork =
      CONTENT_DOCUMENT_LIMIT +
      PROJECTION_PAGE_LIMIT * (SEARCH_DOCUMENT_LIMIT + 4 * HEAD_DOCUMENT_LIMIT);

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
    const maximumArticleWork = ARTICLE_BUCKET_SIZE * 6 * HEAD_DOCUMENT_LIMIT;

    expect(maximumArticleWork).toBeLessThanOrEqual(
      TRANSACTION_READ_LIMIT - TRANSACTION_READ_HEADROOM
    );
  });
});
