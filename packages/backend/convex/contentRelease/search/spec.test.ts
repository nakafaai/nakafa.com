import { describe, expect, it } from "@effect/vitest";
import { ContentFamilySchema } from "@nakafa/aksara-contracts/content";
import {
  isSearchFamily,
  SEARCH_FAMILIES,
} from "@repo/backend/convex/contentRelease/search/spec";

describe("contentRelease/search/spec", () => {
  it("keeps only learning families in canonical release order", () => {
    expect(ContentFamilySchema.literals.filter(isSearchFamily)).toEqual(
      SEARCH_FAMILIES
    );
    expect(isSearchFamily("page")).toBe(false);
    expect(isSearchFamily("question")).toBe(false);
  });
});
