import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { VirtualizerHandle } from "virtua";
import { describe, expect, it, vi } from "vitest";
import type { ConversationRow } from "@/components/school/classes/forum/conversation/data/pages";
import {
  canExecuteConversationScrollRequest,
  settleConversationRestore,
} from "@/components/school/classes/forum/conversation/utils/restore";

const forumId = "forum_1" as Id<"schoolClassForums">;
const firstPostId = "post_1" as Id<"schoolClassForumPosts">;
const secondPostId = "post_2" as Id<"schoolClassForumPosts">;

function createRows(): ConversationRow[] {
  return [
    { type: "header" },
    {
      type: "post",
      post: {
        _creationTime: Date.UTC(2026, 3, 21, 8, 0, 0),
        _id: firstPostId,
        attachments: [],
        body: "post-1",
        classId: "class_1" as Id<"schoolClasses">,
        createdBy: "user_1" as Id<"users">,
        forumId,
        isUnread: false,
        mentions: [],
        myReactions: [],
        reactionCounts: [],
        reactionUsers: [],
        replyCount: 0,
        replyToBody: undefined,
        replyToUser: null,
        replyToUserId: undefined,
        sequence: 1,
        updatedAt: Date.UTC(2026, 3, 21, 8, 0, 0),
        user: null,
      },
    },
    {
      type: "post",
      post: {
        _creationTime: Date.UTC(2026, 3, 21, 8, 1, 0),
        _id: secondPostId,
        attachments: [],
        body: "post-2",
        classId: "class_1" as Id<"schoolClasses">,
        createdBy: "user_2" as Id<"users">,
        forumId,
        isUnread: false,
        mentions: [],
        myReactions: [],
        reactionCounts: [],
        reactionUsers: [],
        replyCount: 0,
        replyToBody: undefined,
        replyToUser: null,
        replyToUserId: undefined,
        sequence: 2,
        updatedAt: Date.UTC(2026, 3, 21, 8, 1, 0),
        user: null,
      },
    },
  ];
}

function createHandle({
  findItemIndex = () => 1,
  getItemOffset = (index: number) => index * 120,
  scrollOffset = 0,
  scrollSize = 480,
  viewportSize = 320,
}: {
  findItemIndex?: VirtualizerHandle["findItemIndex"];
  getItemOffset?: VirtualizerHandle["getItemOffset"];
  scrollOffset?: number;
  scrollSize?: number;
  viewportSize?: number;
} = {}) {
  // Virtua models `cache` as an opaque snapshot with a unique symbol key.
  // The restore helpers never read it, so a test-only opaque stub is enough.
  const cache = Object.create(null) as VirtualizerHandle["cache"];

  return {
    cache,
    findItemIndex,
    getItemOffset,
    getItemSize: () => 120,
    scrollBy: vi.fn(),
    scrollOffset,
    scrollSize,
    scrollTo: vi.fn(),
    scrollToIndex: vi.fn(),
    viewportSize,
  } satisfies VirtualizerHandle;
}

describe("conversation/utils/restore", () => {
  it("waits until Virtua has measured the viewport before executing a restore", () => {
    const rows = createRows();
    const handle = createHandle({ viewportSize: 0 });

    expect(
      canExecuteConversationScrollRequest({
        handle,
        request: {
          exact: false,
          smooth: false,
          view: { kind: "bottom" },
        },
        rows,
      })
    ).toBe(false);
  });

  it("executes a post restore once the target row exists in the measured rows", () => {
    const rows = createRows();
    const handle = createHandle();

    expect(
      canExecuteConversationScrollRequest({
        handle,
        request: {
          exact: false,
          smooth: true,
          view: {
            kind: "post",
            offset: 0,
            postId: secondPostId,
          },
        },
        rows,
      })
    ).toBe(true);
  });

  it("uses one bounded correction to reach the real bottom after late measurement changes", () => {
    const rows = createRows();
    const handle = createHandle({
      scrollOffset: 0,
      scrollSize: 600,
      viewportSize: 320,
    });

    expect(
      settleConversationRestore({
        correctionCount: 0,
        handle,
        request: {
          exact: false,
          smooth: false,
          view: { kind: "bottom" },
        },
        rows,
      })
    ).toEqual({
      correctionCount: 1,
      settled: false,
    });
    expect(handle.scrollToIndex).toHaveBeenCalledWith(rows.length - 1, {
      align: "end",
    });
  });

  it("replays an exact post restore with scrollTo when the saved offset drifted", () => {
    const rows = createRows();
    const handle = createHandle({
      findItemIndex: () => 1,
      getItemOffset: (index) => (index === 2 ? 240 : index * 120),
      scrollOffset: 10,
    });

    expect(
      settleConversationRestore({
        correctionCount: 0,
        handle,
        request: {
          exact: true,
          smooth: true,
          view: {
            kind: "post",
            offset: 24,
            postId: secondPostId,
          },
        },
        rows,
      })
    ).toEqual({
      correctionCount: 1,
      settled: false,
    });
    expect(handle.scrollTo).toHaveBeenCalledWith(216);
  });
});
