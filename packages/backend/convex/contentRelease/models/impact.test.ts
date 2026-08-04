import { ContentKeySchema } from "@nakafa/aksara-contracts/ids";
import { PublicationScopeSchema } from "@nakafa/aksara-contracts/release/snapshot/spec";
import { getReadModelImpact } from "@repo/backend/convex/contentRelease/models/impact";
import { describe, expect, it } from "vitest";

/** Builds one canonical family-wide scope for impact classification. */
function familyScope(family: "article" | "material" | "question") {
  return PublicationScopeSchema.make({
    content: [],
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
    expect(getReadModelImpact(familyScope("question"))).toEqual({
      article: false,
      material: false,
      search: false,
    });
  });

  it("uses the family carried by an exact content identity", () => {
    const scope = PublicationScopeSchema.make({
      content: [
        {
          contentKey: ContentKeySchema.make("material:test"),
          family: "material",
          locale: "en",
        },
      ],
      families: [],
      snapshots: [],
    });

    expect(getReadModelImpact(scope)).toEqual({
      article: false,
      material: true,
      search: true,
    });
  });
});
