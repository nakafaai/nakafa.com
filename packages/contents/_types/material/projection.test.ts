import { normalizeMaterialRoute } from "@repo/contents/_types/material/projection";
import { describe, expect, it } from "vitest";

describe("material projection", () => {
  it("normalizes leading and trailing route separators", () => {
    expect(
      normalizeMaterialRoute("//material/lesson/biology/custom-topic/")
    ).toBe("material/lesson/biology/custom-topic");
  });
});
