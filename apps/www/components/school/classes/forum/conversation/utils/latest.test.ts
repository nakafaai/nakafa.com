import { describe, expect, it, vi } from "vitest";
import { goToLatestEdge } from "@/components/school/classes/forum/conversation/utils/latest";

/** Creates one minimal latest-edge dependency set for command tests. */
function createOptions(overrides?: {
  isAtLatestEdge?: boolean;
  smooth?: boolean;
}) {
  return {
    cancelPendingJumpRequest: vi.fn(),
    clearScrollCommand: vi.fn(),
    isAtLatestEdge: overrides?.isAtLatestEdge ?? false,
    markPendingBottomPersistence: vi.fn(),
    pendingLatestSessionRef: { current: false },
    scrollRef: {
      current: {
        scrollToBottom: vi.fn(),
      },
    },
    showLatestPosts: vi.fn(),
    showLiveConversation: vi.fn(),
    smooth: overrides?.smooth ?? true,
  };
}

describe("conversation/utils/latest", () => {
  it("navigates to the loaded latest edge without clearing command-driven state twice", () => {
    const options = createOptions({ isAtLatestEdge: true });

    goToLatestEdge(options);

    expect(options.markPendingBottomPersistence).toHaveBeenCalledTimes(1);
    expect(options.cancelPendingJumpRequest).toHaveBeenCalledTimes(1);
    expect(options.pendingLatestSessionRef.current).toBe(false);
    expect(options.scrollRef.current.scrollToBottom).toHaveBeenCalledWith(true);
    expect(options.clearScrollCommand).not.toHaveBeenCalled();
    expect(options.showLiveConversation).not.toHaveBeenCalled();
    expect(options.showLatestPosts).not.toHaveBeenCalled();
  });

  it("switches back to the live transcript when the latest edge is detached", () => {
    const options = createOptions({ isAtLatestEdge: false });

    goToLatestEdge(options);

    expect(options.markPendingBottomPersistence).toHaveBeenCalledTimes(1);
    expect(options.cancelPendingJumpRequest).toHaveBeenCalledTimes(1);
    expect(options.pendingLatestSessionRef.current).toBe(true);
    expect(options.clearScrollCommand).toHaveBeenCalledTimes(1);
    expect(options.showLiveConversation).toHaveBeenCalledTimes(1);
    expect(options.showLatestPosts).toHaveBeenCalledTimes(1);
    expect(options.scrollRef.current.scrollToBottom).not.toHaveBeenCalled();
  });
});
