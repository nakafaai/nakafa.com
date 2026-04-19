import { describe, expect, it } from "vitest";
import { isForumPostVisible } from "@/components/school/classes/forum/conversation/utils/post-target";

/** Creates one pair of DOM nodes for post-visibility tests. */
function createElements(overrides?: {
  containerBottom?: number;
  containerTop?: number;
  elementBottom?: number;
  elementTop?: number;
}) {
  const container = document.createElement("div");
  const element = document.createElement("div");

  Object.defineProperty(container, "getBoundingClientRect", {
    value: () => ({
      bottom: overrides?.containerBottom ?? 500,
      top: overrides?.containerTop ?? 100,
    }),
  });
  Object.defineProperty(element, "getBoundingClientRect", {
    value: () => ({
      bottom: overrides?.elementBottom ?? 260,
      top: overrides?.elementTop ?? 180,
    }),
  });

  return { container, element };
}

describe("conversation/utils/post-target", () => {
  it("treats any visible part of the post row as visible", () => {
    expect(isForumPostVisible(createElements())).toBe(true);

    expect(
      isForumPostVisible(
        createElements({
          elementBottom: 150,
          elementTop: 90,
        })
      )
    ).toBe(true);
  });

  it("returns false when the row is fully outside the transcript viewport", () => {
    expect(
      isForumPostVisible(
        createElements({
          elementBottom: 120,
          elementTop: 80,
        })
      )
    ).toBe(false);

    expect(
      isForumPostVisible(
        createElements({
          elementBottom: 560,
          elementTop: 520,
        })
      )
    ).toBe(false);
  });
});
