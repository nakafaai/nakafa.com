import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import type { ForumPost } from "@/components/school/classes/forum/conversation/data/entities";
import {
  getInitialConversationUnreadCue,
  useConversationUnreadCue,
} from "@/components/school/classes/forum/conversation/data/unread";

const forumId = "forum_1" as Id<"schoolClassForums">;

function createPost({
  isUnread = false,
  postId,
  sequence,
}: {
  isUnread?: boolean;
  postId: string;
  sequence: number;
}) {
  const createdAt = Date.UTC(2026, 3, 20, 8, sequence, 0);

  return {
    _creationTime: createdAt,
    _id: postId as Id<"schoolClassForumPosts">,
    attachments: [],
    body: `post-${sequence}`,
    classId: "class_1" as Id<"schoolClasses">,
    createdBy: "user_1" as Id<"users">,
    forumId,
    isUnread,
    mentions: [],
    myReactions: [],
    reactionCounts: [],
    reactionUsers: [],
    replyCount: 0,
    replyToBody: undefined,
    replyToUser: null,
    replyToUserId: undefined,
    sequence,
    updatedAt: createdAt,
    user: null,
  } satisfies ForumPost;
}

function createHarness() {
  let latest: ReturnType<typeof useConversationUnreadCue> | undefined;

  function Harness({
    isPending,
    posts,
  }: {
    isPending: boolean;
    posts: ForumPost[];
  }) {
    latest = useConversationUnreadCue({
      isPending,
      posts,
    });

    return null;
  }

  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);

  return {
    cleanup() {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
    getLatest() {
      if (!latest) {
        throw new Error("missing unread hook result");
      }

      return latest;
    },
    render(props: Parameters<typeof Harness>[0]) {
      act(() => {
        root.render(createElement(Harness, props));
      });
    },
  };
}

describe("conversation/data/unread", () => {
  it("returns the first unread post id and total unread count", () => {
    const cue = getInitialConversationUnreadCue([
      createPost({ postId: "post_1", sequence: 1 }),
      createPost({ isUnread: true, postId: "post_2", sequence: 2 }),
      createPost({ isUnread: true, postId: "post_3", sequence: 3 }),
    ]);

    expect(cue).toEqual({
      count: 2,
      postId: "post_2",
    });
  });

  it("returns null when the transcript has no unread posts", () => {
    const cue = getInitialConversationUnreadCue([
      createPost({ postId: "post_1", sequence: 1 }),
      createPost({ postId: "post_2", sequence: 2 }),
    ]);

    expect(cue).toBeNull();
  });

  it("seeds one initial unread cue after the first resolved transcript result", () => {
    const harness = createHarness();
    const posts = [
      createPost({ postId: "post_1", sequence: 1 }),
      createPost({ isUnread: true, postId: "post_2", sequence: 2 }),
      createPost({ isUnread: true, postId: "post_3", sequence: 3 }),
    ];

    harness.render({
      isPending: true,
      posts: [],
    });
    expect(harness.getLatest().unreadCue).toBeNull();

    harness.render({
      isPending: false,
      posts,
    });
    expect(harness.getLatest().unreadCue).toEqual({
      count: 2,
      postId: "post_2",
      status: "new",
    });

    harness.cleanup();
  });

  it("keeps the seeded initial unread anchor and downgrades it to history", () => {
    const harness = createHarness();

    harness.render({
      isPending: false,
      posts: [
        createPost({ isUnread: true, postId: "post_1", sequence: 1 }),
        createPost({ isUnread: true, postId: "post_2", sequence: 2 }),
      ],
    });

    act(() => {
      harness.getLatest().acknowledgeUnreadCue();
    });

    expect(harness.getLatest().unreadCue).toEqual({
      count: 2,
      postId: "post_1",
      status: "history",
    });

    act(() => {
      harness.getLatest().acknowledgeUnreadCue();
    });

    expect(harness.getLatest().unreadCue).toEqual({
      count: 2,
      postId: "post_1",
      status: "history",
    });

    harness.render({
      isPending: false,
      posts: [
        createPost({ postId: "post_1", sequence: 1 }),
        createPost({ postId: "post_2", sequence: 2 }),
      ],
    });

    expect(harness.getLatest().unreadCue).toEqual({
      count: 2,
      postId: "post_1",
      status: "history",
    });

    harness.cleanup();
  });

  it("keeps the unread cue reference stable until its status changes", () => {
    const harness = createHarness();
    const posts = [
      createPost({ isUnread: true, postId: "post_1", sequence: 1 }),
      createPost({ isUnread: true, postId: "post_2", sequence: 2 }),
    ];

    harness.render({
      isPending: false,
      posts,
    });
    const newCue = harness.getLatest().unreadCue;

    harness.render({
      isPending: false,
      posts,
    });
    expect(harness.getLatest().unreadCue).toBe(newCue);

    act(() => {
      harness.getLatest().acknowledgeUnreadCue();
    });
    const historyCue = harness.getLatest().unreadCue;

    expect(historyCue).not.toBe(newCue);
    expect(historyCue).toEqual({
      count: 2,
      postId: "post_1",
      status: "history",
    });

    harness.render({
      isPending: false,
      posts,
    });
    expect(harness.getLatest().unreadCue).toBe(historyCue);

    harness.cleanup();
  });

  it("ignores acknowledge calls when no unread cue was ever seeded", () => {
    const harness = createHarness();

    harness.render({
      isPending: false,
      posts: [createPost({ postId: "post_1", sequence: 1 })],
    });

    act(() => {
      harness.getLatest().acknowledgeUnreadCue();
    });

    expect(harness.getLatest().unreadCue).toBeNull();

    harness.cleanup();
  });
});
