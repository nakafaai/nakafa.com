import { CONTENT_DOCUMENT_LIMIT } from "@repo/backend/convex/contentRelease/document";
import {
  TRANSACTION_READ_HEADROOM,
  TRANSACTION_READ_LIMIT,
} from "@repo/backend/convex/contentRelease/spec";
import {
  TRYOUT_CATALOG_DOCUMENT_LIMIT,
  TRYOUT_CATALOG_LIMIT,
  TRYOUT_PLACEMENT_DOCUMENT_LIMIT,
  TRYOUT_SECTION_LIMIT,
  TRYOUT_SET_QUESTION_LIMIT,
} from "@repo/backend/convex/contentRelease/tryout/limits";
import { describe, expect, it } from "vitest";

describe("contentRelease/tryout/limits", () => {
  const ownerBytes = 3 * CONTENT_DOCUMENT_LIMIT;

  it("bounds complete catalog and section reads", () => {
    const catalogBytes =
      ownerBytes + TRYOUT_CATALOG_LIMIT * TRYOUT_CATALOG_DOCUMENT_LIMIT;
    const sectionBytes =
      ownerBytes +
      TRYOUT_CATALOG_DOCUMENT_LIMIT +
      TRYOUT_SECTION_LIMIT * TRYOUT_PLACEMENT_DOCUMENT_LIMIT;

    expect(catalogBytes).toBeLessThanOrEqual(
      TRANSACTION_READ_LIMIT - TRANSACTION_READ_HEADROOM
    );
    expect(sectionBytes).toBeLessThanOrEqual(
      TRANSACTION_READ_LIMIT - TRANSACTION_READ_HEADROOM
    );
  });

  it("bounds one complete set across its sections and placements", () => {
    const maximumSetBytes =
      ownerBytes +
      TRYOUT_CATALOG_DOCUMENT_LIMIT +
      TRYOUT_SET_QUESTION_LIMIT *
        (TRYOUT_CATALOG_DOCUMENT_LIMIT + TRYOUT_PLACEMENT_DOCUMENT_LIMIT);

    expect(maximumSetBytes).toBeLessThanOrEqual(
      TRANSACTION_READ_LIMIT - TRANSACTION_READ_HEADROOM
    );
  });
});
