import { describe, expect, it } from "vitest";
import { isForumPostVisible } from "@/components/school/classes/forum/conversation/utils/post-target";

/** Creates one minimal virtual handle for post visibility tests. */
function createHandle(overrides?: {
  itemOffset?: number;
  itemSize?: number;
  scrollOffset?: number;
  viewportSize?: number;
}) {
  return {
    getItemOffset: () => overrides?.itemOffset ?? 240,
    getItemSize: () => overrides?.itemSize ?? 80,
    getScrollOffset: () => overrides?.scrollOffset ?? 200,
    getViewportSize: () => overrides?.viewportSize ?? 400,
  };
}

describe("conversation/utils/post-target", () => {
  it("treats any visible part of the post row as visible", () => {
    expect(
      isForumPostVisible({
        handle: createHandle({
          itemOffset: 240,
          scrollOffset: 200,
          viewportSize: 400,
        }),
        index: 5,
      })
    ).toBe(true);

    expect(
      isForumPostVisible({
        handle: createHandle({
          itemOffset: 180,
          itemSize: 80,
          scrollOffset: 200,
          viewportSize: 300,
        }),
        index: 5,
      })
    ).toBe(true);
  });

  it("returns false when viewport geometry is not measurable or fully outside", () => {
    expect(
      isForumPostVisible({
        handle: createHandle({ viewportSize: 0 }),
        index: 5,
      })
    ).toBe(false);

    expect(
      isForumPostVisible({
        handle: createHandle({
          itemOffset: 800,
          scrollOffset: 200,
          viewportSize: 300,
        }),
        index: 5,
      })
    ).toBe(false);
  });
});
