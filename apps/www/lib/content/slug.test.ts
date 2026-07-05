import { describe, expect, it } from "vitest";
import { getContentRuntimeSlug } from "@/lib/content/slug";

describe("getContentRuntimeSlug", () => {
  it("normalizes public content paths into Convex runtime slugs", () => {
    expect(
      getContentRuntimeSlug(
        "/try-out/indonesia/snbt/set-1/quantitative-knowledge"
      )
    ).toBe("try-out/indonesia/snbt/set-1/quantitative-knowledge");
    expect(getContentRuntimeSlug("articles/politics/example")).toBe(
      "articles/politics/example"
    );
    expect(getContentRuntimeSlug("//kurikulum/merdeka/kelas-10/math//")).toBe(
      "kurikulum/merdeka/kelas-10/math"
    );
  });
});
