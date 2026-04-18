import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { describe, expect, it } from "vitest";
import {
  resolveScrollCommand,
  type ScrollCommand,
  shouldPersistBottomConversationView,
} from "@/components/school/classes/forum/conversation/scroll-command";

const postId = "post_1" as Id<"schoolClassForumPosts">;

describe("forum conversation scroll command", () => {
  it("waits when there is no pending command", () => {
    expect(
      resolveScrollCommand({
        command: null,
        postIdToIndex: new Map(),
      })
    ).toBeNull();
  });

  it("waits to run post commands until the target item is rendered", () => {
    const command = {
      align: "center",
      kind: "post",
      offset: 12,
      postId,
    } satisfies ScrollCommand;

    expect(
      resolveScrollCommand({
        command,
        postIdToIndex: new Map(),
      })
    ).toBeNull();

    expect(
      resolveScrollCommand({
        command,
        postIdToIndex: new Map([[postId, 7]]),
      })
    ).toEqual({
      align: "center",
      index: 7,
      kind: "post",
      offset: 12,
    });
  });

  it("only persists bottom after a latest command really lands at the viewport bottom", () => {
    expect(
      shouldPersistBottomConversationView({
        hasPendingBottomPersistence: false,
        isAtBottom: true,
        isAtLatestEdge: true,
        isInitialAnchorSettled: true,
      })
    ).toBe(false);

    expect(
      shouldPersistBottomConversationView({
        hasPendingBottomPersistence: true,
        isAtBottom: false,
        isAtLatestEdge: true,
        isInitialAnchorSettled: true,
      })
    ).toBe(false);

    expect(
      shouldPersistBottomConversationView({
        hasPendingBottomPersistence: true,
        isAtBottom: true,
        isAtLatestEdge: false,
        isInitialAnchorSettled: true,
      })
    ).toBe(false);

    expect(
      shouldPersistBottomConversationView({
        hasPendingBottomPersistence: true,
        isAtBottom: true,
        isAtLatestEdge: true,
        isInitialAnchorSettled: false,
      })
    ).toBe(false);

    expect(
      shouldPersistBottomConversationView({
        hasPendingBottomPersistence: true,
        isAtBottom: true,
        isAtLatestEdge: true,
        isInitialAnchorSettled: true,
      })
    ).toBe(true);
  });
});
