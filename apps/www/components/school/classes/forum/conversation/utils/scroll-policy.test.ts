import { describe, expect, it } from "vitest";
import { getForumPrefetchDistance } from "@/components/school/classes/forum/conversation/utils/scroll-policy";

describe("forum conversation scroll policy", () => {
  it("uses the minimum prefetch distance on small viewports", () => {
    expect(getForumPrefetchDistance(100)).toBe(200);
  });

  it("scales with the viewport inside the normal range", () => {
    expect(getForumPrefetchDistance(400)).toBe(300);
  });

  it("caps the prefetch distance on large viewports", () => {
    expect(getForumPrefetchDistance(1200)).toBe(600);
  });
});
