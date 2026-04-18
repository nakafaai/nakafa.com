import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { describe, expect, it } from "vitest";
import {
  consumePendingPostTargetRetry,
  createPendingPostTarget,
  isPendingPostTargetVisible,
  resolvePendingPostTargetIndex,
  resolvePendingPostTargetProgress,
  shouldRetryPendingPostTarget,
} from "@/components/school/classes/forum/conversation/utils/post-target";

const postId = "post_1" as Id<"schoolClassForumPosts">;

/** Creates one lightweight virtual scroll handle for post-target tests. */
function createHandle(overrides?: {
  itemOffset?: number;
  scrollOffset?: number;
  viewportSize?: number;
}) {
  return {
    getItemOffset: () => overrides?.itemOffset ?? 240,
    getScrollOffset: () => overrides?.scrollOffset ?? 200,
    getViewportSize: () => overrides?.viewportSize ?? 400,
  };
}

describe("forum conversation post target", () => {
  it("creates one retryable pending target for a new jump intent", () => {
    expect(
      createPendingPostTarget({
        align: "center",
        postId,
        reason: "jump-session",
      })
    ).toEqual({
      align: "center",
      attemptsRemaining: 3,
      postId,
      reason: "jump-session",
    });
  });

  it("treats a target top inside the viewport as visible", () => {
    expect(
      isPendingPostTargetVisible({
        handle: createHandle({
          itemOffset: 240,
          scrollOffset: 200,
          viewportSize: 300,
        }),
        index: 5,
      })
    ).toBe(true);

    expect(
      isPendingPostTargetVisible({
        handle: createHandle({
          itemOffset: 600,
          scrollOffset: 200,
          viewportSize: 300,
        }),
        index: 5,
      })
    ).toBe(false);

    expect(
      isPendingPostTargetVisible({
        handle: createHandle({
          itemOffset: 240,
          scrollOffset: 200,
          viewportSize: 0,
        }),
        index: 5,
      })
    ).toBe(false);
  });

  it("resolves the currently rendered index for the pending target id", () => {
    const pendingPostTarget = createPendingPostTarget({
      align: "center",
      postId,
      reason: "jump-session",
    });

    expect(
      resolvePendingPostTargetIndex({
        pendingPostTarget,
        postIdToIndex: new Map([[postId, 9]]),
      })
    ).toBe(9);

    expect(
      resolvePendingPostTargetIndex({
        pendingPostTarget,
        postIdToIndex: new Map(),
      })
    ).toBeNull();
  });

  it("resolves idle when there is no pending target", () => {
    expect(
      resolvePendingPostTargetProgress({
        handle: createHandle(),
        pendingPostTarget: null,
        postIdToIndex: new Map(),
      })
    ).toEqual({ kind: "idle" });
  });

  it("waits while the target is not rendered or the handle is unavailable", () => {
    const pendingPostTarget = createPendingPostTarget({
      align: "center",
      postId,
      reason: "jump-session",
    });

    expect(
      resolvePendingPostTargetProgress({
        handle: null,
        pendingPostTarget,
        postIdToIndex: new Map([[postId, 4]]),
      })
    ).toEqual({ kind: "waiting" });

    expect(
      resolvePendingPostTargetProgress({
        handle: createHandle(),
        pendingPostTarget,
        postIdToIndex: new Map(),
      })
    ).toEqual({ kind: "waiting" });
  });

  it("settles once the target becomes visible", () => {
    const pendingPostTarget = createPendingPostTarget({
      align: "center",
      postId,
      reason: "in-session-post-command",
    });

    expect(
      resolvePendingPostTargetProgress({
        handle: createHandle({
          itemOffset: 240,
          scrollOffset: 200,
          viewportSize: 300,
        }),
        pendingPostTarget,
        postIdToIndex: new Map([[postId, 4]]),
      })
    ).toEqual({ kind: "settled" });
  });

  it("retries hidden targets while retry budget remains", () => {
    const pendingPostTarget = createPendingPostTarget({
      align: "center",
      offset: 12,
      postId,
      reason: "jump-session",
    });

    expect(
      resolvePendingPostTargetProgress({
        handle: createHandle({
          itemOffset: 600,
          scrollOffset: 200,
          viewportSize: 300,
        }),
        pendingPostTarget,
        postIdToIndex: new Map([[postId, 7]]),
      })
    ).toEqual({
      align: "center",
      index: 7,
      kind: "retry",
      nextPendingPostTarget: {
        ...pendingPostTarget,
        attemptsRemaining: 2,
      },
      offset: 12,
    });
  });

  it("stops retrying after the automatic budget is exhausted", () => {
    const pendingPostTarget = consumePendingPostTargetRetry(
      consumePendingPostTargetRetry(
        consumePendingPostTargetRetry(
          createPendingPostTarget({
            align: "center",
            postId,
            reason: "jump-session",
          })
        )
      )
    );

    expect(shouldRetryPendingPostTarget(pendingPostTarget)).toBe(false);

    expect(
      resolvePendingPostTargetProgress({
        handle: createHandle({
          itemOffset: 600,
          scrollOffset: 200,
          viewportSize: 300,
        }),
        pendingPostTarget,
        postIdToIndex: new Map([[postId, 7]]),
      })
    ).toEqual({ kind: "waiting" });
  });
});
