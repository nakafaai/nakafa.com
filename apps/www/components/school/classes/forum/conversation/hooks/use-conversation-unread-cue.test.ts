import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { createConversationTestPost } from "@/components/school/classes/forum/conversation/helpers/test";
import { useConversationUnreadCue } from "@/components/school/classes/forum/conversation/hooks/use-conversation-unread-cue";

function createHarness() {
  let latest: ReturnType<typeof useConversationUnreadCue> | undefined;

  function Harness({
    isPending,
    posts,
  }: Parameters<typeof useConversationUnreadCue>[0]) {
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

describe("conversation/hooks/use-conversation-unread-cue", () => {
  it("seeds one initial unread cue after the first resolved transcript result", () => {
    const harness = createHarness();
    const posts = [
      createConversationTestPost({ postId: "post_1", sequence: 1 }),
      createConversationTestPost({
        isUnread: true,
        postId: "post_2",
        sequence: 2,
      }),
      createConversationTestPost({
        isUnread: true,
        postId: "post_3",
        sequence: 3,
      }),
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
        createConversationTestPost({
          isUnread: true,
          postId: "post_1",
          sequence: 1,
        }),
        createConversationTestPost({
          isUnread: true,
          postId: "post_2",
          sequence: 2,
        }),
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
        createConversationTestPost({ postId: "post_1", sequence: 1 }),
        createConversationTestPost({ postId: "post_2", sequence: 2 }),
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
      createConversationTestPost({
        isUnread: true,
        postId: "post_1",
        sequence: 1,
      }),
      createConversationTestPost({
        isUnread: true,
        postId: "post_2",
        sequence: 2,
      }),
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
      posts: [createConversationTestPost({ postId: "post_1", sequence: 1 })],
    });

    act(() => {
      harness.getLatest().acknowledgeUnreadCue();
    });

    expect(harness.getLatest().unreadCue).toBeNull();

    harness.cleanup();
  });
});
