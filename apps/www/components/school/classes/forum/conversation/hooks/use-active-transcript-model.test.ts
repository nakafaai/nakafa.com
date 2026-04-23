import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import {
  createConversationTestForum,
  createConversationTestPost,
} from "@/components/school/classes/forum/conversation/helpers/test";
import { useActiveTranscriptModel } from "@/components/school/classes/forum/conversation/hooks/use-active-transcript-model";

function createHarness() {
  let latest: ReturnType<typeof useActiveTranscriptModel> | undefined;

  function Harness({
    forum,
    posts,
    unreadCue,
  }: Parameters<typeof useActiveTranscriptModel>[0]) {
    latest = useActiveTranscriptModel({
      forum,
      posts,
      unreadCue,
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
        throw new Error("missing active transcript model");
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

describe("conversation/hooks/use-active-transcript-model", () => {
  it("memoizes the active transcript model while the input references stay stable", () => {
    const harness = createHarness();
    const forum = createConversationTestForum();
    const posts = [
      createConversationTestPost({
        createdAt: Date.UTC(2026, 3, 20, 8, 0, 0),
        postId: "post_1",
        sequence: 1,
      }),
    ];
    const unreadCue = {
      count: 1,
      postId: posts[0]._id,
      status: "new",
    } as const;

    harness.render({
      forum,
      posts,
      unreadCue,
    });
    const firstResult = harness.getLatest();

    harness.render({
      forum,
      posts,
      unreadCue,
    });
    expect(harness.getLatest()).toBe(firstResult);

    harness.render({
      forum,
      posts: [...posts],
      unreadCue,
    });
    expect(harness.getLatest()).not.toBe(firstResult);

    harness.cleanup();
  });
});
