import { describe, expect, it } from "vitest";
import { getContentRuntimeSlug } from "@/lib/content/slug";

describe("getContentRuntimeSlug", () => {
  it("normalizes public content paths into Convex runtime slugs", () => {
    expect(
      getContentRuntimeSlug("/material/practice/assessment/snbt/set-1/1")
    ).toBe("material/practice/assessment/snbt/set-1/1");
    expect(getContentRuntimeSlug("articles/politics/example")).toBe(
      "articles/politics/example"
    );
    expect(getContentRuntimeSlug("//curriculum/high-school/10/math//")).toBe(
      "curriculum/high-school/10/math"
    );
  });
});
