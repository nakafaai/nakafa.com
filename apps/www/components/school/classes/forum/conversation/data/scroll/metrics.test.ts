import { describe, expect, it, vi } from "vitest";
import {
  type ConversationGeometryHandle,
  getConversationBottomDistance,
  isConversationAtBottom,
  isConversationAtTop,
} from "@/components/school/classes/forum/conversation/data/scroll/metrics";

/** Creates a minimal virtualizer geometry handle for scroll metric tests. */
function createHandle({
  scrollOffset,
  scrollSize = 500,
  viewportSize = 200,
}: {
  scrollOffset: number;
  scrollSize?: number;
  viewportSize?: number;
}) {
  return {
    findItemIndex: vi.fn().mockReturnValue(0),
    getItemOffset: vi.fn().mockReturnValue(0),
    getItemSize: vi.fn().mockReturnValue(0),
    scrollOffset,
    scrollSize,
    viewportSize,
  } satisfies ConversationGeometryHandle;
}

describe("conversation/data/scroll/metrics", () => {
  it("returns the current virtual bottom distance", () => {
    expect(
      getConversationBottomDistance(
        createHandle({
          scrollOffset: 300,
        })
      )
    ).toBe(0);

    expect(
      getConversationBottomDistance(
        createHandle({
          scrollOffset: 288,
        })
      )
    ).toBe(12);
  });

  it("detects top and bottom edge settlement with scroll tolerance", () => {
    expect(
      isConversationAtBottom(
        createHandle({
          scrollOffset: 298,
        })
      )
    ).toBe(true);
    expect(
      isConversationAtTop(
        createHandle({
          scrollOffset: 2,
        })
      )
    ).toBe(true);
  });
});
