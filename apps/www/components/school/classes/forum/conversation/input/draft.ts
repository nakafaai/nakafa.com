import { Effect } from "effect";
import type { ForumReplyTarget } from "@/components/school/classes/forum/session/store";

/** Composer draft captured before an optimistic submit clears the input. */
export interface ForumPostInputDraft {
  body: string;
  replyTarget: ForumReplyTarget | null;
}

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
