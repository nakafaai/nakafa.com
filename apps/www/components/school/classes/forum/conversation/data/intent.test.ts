import { describe, expect, it } from "vitest";
import {
  getConversationScrollIntent,
  getNextConversationBottomDetachment,
} from "@/components/school/classes/forum/conversation/data/intent";

describe("conversation/data/intent", () => {
  it("derives scroll intent from virtualizer offsets", () => {
    expect(
      getConversationScrollIntent({
        currentOffset: 90,
        previousOffset: 100,
      })
    ).toBe("up");
    expect(
      getConversationScrollIntent({
        currentOffset: 110,
        previousOffset: 100,
      })
    ).toBe("down");
    expect(
      getConversationScrollIntent({
        currentOffset: 100,
        previousOffset: 100,
      })
    ).toBe("none");
  });

  it("detaches from bottom immediately when the user scrolls upward", () => {
    expect(
      getNextConversationBottomDetachment({
        isAtBottom: true,
        isDetachedFromBottom: false,
        scrollIntent: "up",
      })
    ).toBe(true);
  });

  it("keeps a detached viewer detached during plain viewport measurement", () => {
    expect(
      getNextConversationBottomDetachment({
        isAtBottom: true,
        isDetachedFromBottom: true,
        scrollIntent: "none",
      })
    ).toBe(true);
  });

  it("reattaches only after a downward scroll reaches the latest edge", () => {
    expect(
      getNextConversationBottomDetachment({
        isAtBottom: true,
        isDetachedFromBottom: true,
        scrollIntent: "down",
      })
    ).toBe(false);
    expect(
      getNextConversationBottomDetachment({
        isAtBottom: false,
        isDetachedFromBottom: true,
        scrollIntent: "down",
      })
    ).toBe(true);
  });
});
