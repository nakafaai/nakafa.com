import { Effect, Schema } from "effect";
import {
  type ForumReplyTarget,
  ForumReplyTargetSchema,
} from "@/components/school/classes/forum/session/store";

/** Composer draft captured before an optimistic submit clears the input. */
const ForumPostInputDraftSchema = Schema.Struct({
  body: Schema.String,
  replyTarget: Schema.NullOr(ForumReplyTargetSchema),
});
export type ForumPostInputDraft = typeof ForumPostInputDraftSchema.Type;

/** Restores a failed optimistic submit without overwriting newer user input. */
export function restoreForumPostInputDraft({
  currentBody,
  currentReplyTarget,
  draft,
  restoreBody,
  restoreReplyTarget,
}: {
  currentBody: string;
  currentReplyTarget: ForumReplyTarget | null;
  draft: ForumPostInputDraft;
  restoreBody: (body: string) => void;
  restoreReplyTarget: (replyTarget: ForumReplyTarget) => void;
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
