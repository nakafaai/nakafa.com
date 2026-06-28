import { describe, expect, it } from "vitest";
import {
  getConversationBottomDistance,
  getConversationViewportState,
  isConversationAtBottom,
  isConversationAtTop,
} from "@/components/school/classes/forum/conversation/data/metrics";
import { createConversationTestHandle } from "@/components/school/classes/forum/conversation/helpers/test";

function createHandle({
  scrollOffset,
  scrollSize = 500,
  viewportSize = 200,
}: {
  scrollOffset: number;
  scrollSize?: number;
  viewportSize?: number;
}) {
  return createConversationTestHandle({
    scrollOffset,
    scrollSize,
    viewportSize,
  }).handle;
}

describe("conversation/data/metrics", () => {
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
          scrollOffset: 288,
        })
      )
    ).toBe(true);
    expect(
      isConversationAtTop(
        createHandle({
          scrollOffset: 12,
        })
      )
    ).toBe(true);
  });

  it("waits for a measured viewport before deriving jump-bar state", () => {
    expect(
      getConversationViewportState(
        createHandle({
          scrollOffset: 0,
          scrollSize: 300,
          viewportSize: 0,
        })
      )
    ).toBeNull();
  });

  it("derives jump-bar state from measured virtualizer metrics", () => {
    expect(
      getConversationViewportState(
        createHandle({
          scrollOffset: 0,
          scrollSize: 300,
          viewportSize: 500,
        })
      )
    ).toEqual({
      hasOverflow: false,
      isAtBottom: true,
    });

    expect(
      getConversationViewportState(
        createHandle({
          scrollOffset: 100,
          scrollSize: 800,
          viewportSize: 500,
        })
      )
    ).toEqual({
      hasOverflow: true,
      isAtBottom: false,
    });
  });

  it("treats a detached viewer as away from bottom inside the edge tolerance", () => {
    const nearBottomHandle = createHandle({
      scrollOffset: 292,
    });

    expect(getConversationViewportState(nearBottomHandle)).toEqual({
      hasOverflow: true,
      isAtBottom: true,
    });

    expect(
      getConversationViewportState(nearBottomHandle, {
        isDetachedFromBottom: true,
      })
    ).toEqual({
      hasOverflow: true,
      isAtBottom: false,
    });
  });
});
