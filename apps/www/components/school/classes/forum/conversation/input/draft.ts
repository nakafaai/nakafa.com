import { Effect } from "effect";
import type { ForumReplyTarget } from "@/components/school/classes/forum/store/session";

/** Composer draft captured before an optimistic submit clears the input. */
export interface ForumPostInputDraft {
  body: string;
  replyTarget: ForumReplyTarget | null;
}

interface RestoreForumPostInputDraftInput {
  currentBody: string;
  currentReplyTarget: ForumReplyTarget | null;
  draft: ForumPostInputDraft;
  restoreBody: (body: string) => void;
  restoreReplyTarget: (replyTarget: ForumReplyTarget) => void;
}

/** Restores a failed optimistic submit without overwriting newer user input. */
export function restoreForumPostInputDraft({
  currentBody,
  currentReplyTarget,
  draft,
  restoreBody,
  restoreReplyTarget,
}: RestoreForumPostInputDraftInput) {
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
