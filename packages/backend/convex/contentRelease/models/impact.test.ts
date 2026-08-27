import { describe, expect, it } from "@effect/vitest";
import type { ContentFamily } from "@nakafa/aksara-contracts/content";
import { PublicationScopeSchema } from "@nakafa/aksara-contracts/release/snapshot/scope";
import { getReadModelImpact } from "@repo/backend/convex/contentRelease/models/impact";

/** Builds one canonical family-wide scope for impact classification. */
function familyScope(family: ContentFamily) {
  return PublicationScopeSchema.make({
    families: [family],
    snapshots: [],
  });
}

describe("contentRelease/models/impact", () => {
  it("maps authored family changes to their dependent read models", () => {
    expect(getReadModelImpact(familyScope("article"))).toEqual({
      article: true,
      material: false,
      search: true,
    });
    expect(getReadModelImpact(familyScope("material"))).toEqual({
      article: false,
      material: true,
      search: true,
    });
    expect(getReadModelImpact(familyScope("page"))).toEqual({
      article: false,
      material: false,
      search: false,
    });
    expect(getReadModelImpact(familyScope("question"))).toEqual({
      article: false,
      material: false,
      search: false,
    });
  });
});
