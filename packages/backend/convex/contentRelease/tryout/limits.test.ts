import {
  TRANSACTION_READ_HEADROOM,
  TRANSACTION_READ_LIMIT,
} from "@repo/backend/convex/contentRelease/spec";
import {
  TRYOUT_CATALOG_DOCUMENT_LIMIT,
  TRYOUT_CATALOG_LIMIT,
  TRYOUT_PLACEMENT_DOCUMENT_LIMIT,
  TRYOUT_SECTION_LIMIT,
} from "@repo/backend/convex/contentRelease/tryout/limits";
import { describe, expect, it } from "vitest";

describe("contentRelease/tryout/limits", () => {
  it.each([
    [TRYOUT_CATALOG_LIMIT, TRYOUT_CATALOG_DOCUMENT_LIMIT],
    [TRYOUT_SECTION_LIMIT, TRYOUT_PLACEMENT_DOCUMENT_LIMIT],
  ])("reserves transaction headroom for %i maximum rows", (count, bytes) => {
    expect(count * bytes).toBeLessThanOrEqual(
      TRANSACTION_READ_LIMIT - TRANSACTION_READ_HEADROOM
    );
  });
});
