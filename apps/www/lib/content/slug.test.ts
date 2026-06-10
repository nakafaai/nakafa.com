import { describe, expect, it } from "vitest";
import { getContentRuntimeSlug } from "@/lib/content/slug";

describe("getContentRuntimeSlug", () => {
  it("normalizes public content paths into Convex runtime slugs", () => {
    expect(getContentRuntimeSlug("/exercises/high-school/snbt/set-1/1")).toBe(
      "exercises/high-school/snbt/set-1/1"
    );
    expect(getContentRuntimeSlug("articles/politics/example")).toBe(
      "articles/politics/example"
    );
    expect(getContentRuntimeSlug("//subject/high-school/10/math//")).toBe(
      "subject/high-school/10/math"
    );
  });
});
