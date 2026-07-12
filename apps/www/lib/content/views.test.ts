import { describe, expect, it } from "vitest";
import { getContentViewId } from "@/lib/content/views";

const assetIdPrefixPattern = /^asset:id:/;

describe("getContentViewId", () => {
  it("derives localized content identity without a runtime database lookup", () => {
    expect(
      getContentViewId({
        locale: "id",
        route: "articles/politics/dynastic-politics-asian-values",
      })
    ).toMatch(assetIdPrefixPattern);
  });

  it("returns null when a route has no graph projection", () => {
    expect(getContentViewId({ locale: "id", route: "unknown" })).toBeNull();
  });
});
