import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import { Effect, Schema } from "effect";
import type { ForumReplyTarget } from "@/components/school/classes/forum/session/store";

/** Reply target the composer keeps while a reply is being written. */
const ForumReplyTargetSchema = Schema.Struct({
  postId: IdSchema("schoolClassForumPosts"),
  userName: Schema.String,
});

/** Composer draft captured before an optimistic submit clears the input. */
const ForumPostInputDraftSchema = Schema.Struct({
  body: Schema.String,
  replyTarget: Schema.NullOr(ForumReplyTargetSchema),
});

export type ForumPostInputDraft = typeof ForumPostInputDraftSchema.Type;

const RestoreForumPostInputDraftSchema = Schema.Struct({
  currentBody: Schema.String,
  currentReplyTarget: Schema.NullOr(ForumReplyTargetSchema),
  draft: ForumPostInputDraftSchema,
});

type RestoreBody = (body: string) => void;

type RestoreReplyTarget = (replyTarget: ForumReplyTarget) => void;

/** Restores a failed optimistic submit without overwriting newer user input. */
export function restoreForumPostInputDraft({
  currentBody,
  currentReplyTarget,
  draft,
  restoreBody,
  restoreReplyTarget,
}: typeof RestoreForumPostInputDraftSchema.Type & {
  restoreBody: RestoreBody;
  restoreReplyTarget: RestoreReplyTarget;
}) {
  return Effect.sync(() => {
    if (currentBody.trim().length > 0 || currentReplyTarget) {
      return;
    }

    restoreBody(draft.body);

    if (draft.replyTarget) {
      restoreReplyTarget(draft.replyTarget);
    }
  });
}
