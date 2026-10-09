import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import { Effect, Schema } from "effect";
import { restoreForumPostInputDraft } from "@/components/school/classes/forum/conversation/input/draft";

const firstPostId = Schema.decodeUnknownSync(Id("schoolClassForumPosts"))(
  "post_1"
);
const secondPostId = Schema.decodeUnknownSync(Id("schoolClassForumPosts"))(
  "post_2"
);
const replyTarget = {
  postId: firstPostId,
  userName: "Test Learner",
};

describe("conversation/input/draft", () => {
  it.effect("restores the failed draft when the composer is still empty", () =>
    Effect.gen(function* () {
      const restoreBody = vi.fn();
      const restoreReplyTarget = vi.fn();

      yield* restoreForumPostInputDraft({
        currentBody: "",
        currentReplyTarget: null,
        draft: {
          body: "pending message",
          replyTarget,
        },
        restoreBody,
        restoreReplyTarget,
      });

      expect(restoreBody).toHaveBeenCalledWith("pending message");
      expect(restoreReplyTarget).toHaveBeenCalledWith(replyTarget);
    })
  );

  it.effect("restores a failed top-level draft without a reply target", () =>
    Effect.gen(function* () {
      const restoreBody = vi.fn();
      const restoreReplyTarget = vi.fn();

      yield* restoreForumPostInputDraft({
        currentBody: "",
        currentReplyTarget: null,
        draft: {
          body: "pending message",
          replyTarget: null,
        },
        restoreBody,
        restoreReplyTarget,
      });

      expect(restoreBody).toHaveBeenCalledWith("pending message");
      expect(restoreReplyTarget).not.toHaveBeenCalled();
    })
  );

  it.effect("does not overwrite newer body or reply target input", () =>
    Effect.gen(function* () {
      const restoreBody = vi.fn();
      const restoreReplyTarget = vi.fn();

      yield* restoreForumPostInputDraft({
        currentBody: "newer draft",
        currentReplyTarget: replyTarget,
        draft: {
          body: "failed message",
          replyTarget: {
            postId: secondPostId,
            userName: "Other User",
          },
        },
        restoreBody,
        restoreReplyTarget,
      });

      expect(restoreBody).not.toHaveBeenCalled();
      expect(restoreReplyTarget).not.toHaveBeenCalled();
    })
  );

  it.effect(
    "does not attach a failed reply target to newer top-level input",
    () =>
      Effect.gen(function* () {
        const restoreBody = vi.fn();
        const restoreReplyTarget = vi.fn();

        yield* restoreForumPostInputDraft({
          currentBody: "new top-level draft",
          currentReplyTarget: null,
          draft: {
            body: "failed reply",
            replyTarget,
          },
          restoreBody,
          restoreReplyTarget,
        });

        expect(restoreBody).not.toHaveBeenCalled();
        expect(restoreReplyTarget).not.toHaveBeenCalled();
      })
  );
});
