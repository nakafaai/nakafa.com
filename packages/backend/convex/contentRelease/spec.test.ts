import {
  CONTENT_DOCUMENT_LIMIT,
  HEAD_DOCUMENT_LIMIT,
} from "@repo/backend/convex/contentRelease/document";
import { RELEASE_PAGE_LIMIT } from "@repo/backend/convex/contentRelease/spec";
import { describe, expect, it } from "vitest";

const TRANSACTION_LIMIT = 16 * 1024 * 1024;
const TRANSACTION_HEADROOM = 4 * 1024 * 1024;

describe("contentRelease/spec", () => {
  it("preserves four MiB around worst-case lifecycle pages", () => {
    const maximumPageBytes =
      RELEASE_PAGE_LIMIT *
      (2 * CONTENT_DOCUMENT_LIMIT + 5 * HEAD_DOCUMENT_LIMIT);

    expect(maximumPageBytes).toBeLessThanOrEqual(
      TRANSACTION_LIMIT - TRANSACTION_HEADROOM
    );
  });
});
