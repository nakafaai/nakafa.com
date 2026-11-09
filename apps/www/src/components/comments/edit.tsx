import { useMutation } from "@confect/react";
import comments from "@repo/backend/confect/_generated/refs/comments";
import { readCommentText } from "@repo/backend/confect/comments/text";
import { LEARNER_TEXT_MAX_LENGTH } from "@repo/backend/confect/writing/text";
import { LearnerEditor } from "@repo/design-system/components/editor/learner";
import { Button } from "@repo/design-system/components/ui/button";
import { toast } from "@repo/design-system/lib/toast/notify";
import { DateTime, Effect, Result } from "effect";
import { useState } from "react";
import { useTranslations } from "use-intl";
import { editInLists } from "@/components/comments/mutation";
import { useCommentDraft } from "@/components/comments/provider";
import { useRowComment } from "@/components/comments/scope";
import { reportClientException } from "@/lib/analytics/client";
import { useDocumentLabels } from "@/lib/editor/labels";

/**
 * The edit of the row's comment, in place of its text: the learner editor opens with the comment's words,
 * and Save shows the new words at once, marked edited, while the server saves them; a refusal puts the old
 * words back and says so. Cancel and Escape leave the comment as it was. Its photos stay as they were posted.
 */
export function CommentEdit() {
  const t = useTranslations("Comments");
  const tCommon = useTranslations("Common");
  const labels = useDocumentLabels();
  const comment = useRowComment();
  const edit = useCommentDraft((draft) => draft.edit);
  const [text, setText] = useState(comment.text);
  const save = useMutation(comments.mutations.editComment);
  const valid = Result.isSuccess(readCommentText(text, comment.photos.length));

  /** Closes the edit and saves the new words, when they changed. */
  function confirm() {
    edit(null);
    if (text === comment.text) {
      return;
    }
    const saving = save.withOptimisticUpdate(
      editInLists(DateTime.toEpochMillis(DateTime.nowUnsafe()))
    );
    Effect.runPromise(
      Effect.tryPromise(() => saving({ commentId: comment._id, text })).pipe(
        Effect.flatMap(Effect.fromResult),
        Effect.matchEffect({
          onSuccess: () => Effect.void,
          onFailure: (error) =>
            reportClientException(error, {
              source: "components/comments/edit",
            }).pipe(
              Effect.andThen(
                Effect.sync(() => {
                  toast.error({
                    description: "action-error.description",
                    title: "action-error.title",
                  });
                })
              )
            ),
        })
      )
    );
  }

  return (
    <div className="py-1">
      <LearnerEditor
        autoFocus
        defaultValue={comment.text}
        label={t("edit-label")}
        labels={{ ...labels.toolbar, formulaEdit: labels.formulaEdit }}
        limit={LEARNER_TEXT_MAX_LENGTH}
        onChange={setText}
        onClose={() => edit(null)}
        onFiles={() => toast.error({ title: "comment-photo-fixed.title" })}
        onRefuse={() => toast.error({ title: "comment-paste-refused.title" })}
        onSubmit={() => {
          if (valid) {
            confirm();
          }
        }}
        placeholder={t("add-comment-placeholder")}
      >
        <Button
          onClick={() => edit(null)}
          size="sm"
          type="button"
          variant="ghost"
        >
          {tCommon("cancel")}
        </Button>
        <Button disabled={!valid} onClick={confirm} size="sm" type="button">
          {tCommon("save")}
        </Button>
      </LearnerEditor>
    </div>
  );
}
