import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";
import { restoreForumPostInputDraft } from "./draft";

const replyTarget = {
  postId: "post_1" as Id<"schoolClassForumPosts">,
  userName: "Nabil Fatih",
};

describe("conversation/input/draft", () => {
  it("restores the failed draft when the composer is still empty", () => {
    const restoreBody = vi.fn();
    const restoreReplyTarget = vi.fn();

    Effect.runSync(
      restoreForumPostInputDraft({
        currentBody: "",
        currentReplyTarget: null,
        draft: {
          body: "pending message",
          replyTarget,
        },
        restoreBody,
        restoreReplyTarget,
      })
    );

    expect(restoreBody).toHaveBeenCalledWith("pending message");
    expect(restoreReplyTarget).toHaveBeenCalledWith(replyTarget);
  });

  it("restores a failed top-level draft without a reply target", () => {
    const restoreBody = vi.fn();
    const restoreReplyTarget = vi.fn();

    Effect.runSync(
      restoreForumPostInputDraft({
        currentBody: "",
        currentReplyTarget: null,
        draft: {
          body: "pending message",
          replyTarget: null,
        },
        restoreBody,
        restoreReplyTarget,
      })
    );

    expect(restoreBody).toHaveBeenCalledWith("pending message");
    expect(restoreReplyTarget).not.toHaveBeenCalled();
  });

  it("does not overwrite newer body or reply target input", () => {
    const restoreBody = vi.fn();
    const restoreReplyTarget = vi.fn();

    Effect.runSync(
      restoreForumPostInputDraft({
        currentBody: "newer draft",
        currentReplyTarget: replyTarget,
        draft: {
          body: "failed message",
          replyTarget: {
            postId: "post_2" as Id<"schoolClassForumPosts">,
            userName: "Other User",
          },
        },
        restoreBody,
        restoreReplyTarget,
      })
    );

    expect(restoreBody).not.toHaveBeenCalled();
    expect(restoreReplyTarget).not.toHaveBeenCalled();
  });

  it("does not attach a failed reply target to newer top-level input", () => {
    const restoreBody = vi.fn();
    const restoreReplyTarget = vi.fn();

    Effect.runSync(
      restoreForumPostInputDraft({
        currentBody: "new top-level draft",
        currentReplyTarget: null,
        draft: {
          body: "failed reply",
          replyTarget,
        },
        restoreBody,
        restoreReplyTarget,
      })
    );

    expect(restoreBody).not.toHaveBeenCalled();
    expect(restoreReplyTarget).not.toHaveBeenCalled();
  });
});
