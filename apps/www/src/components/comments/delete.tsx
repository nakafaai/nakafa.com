import { useMutation } from "@confect/react";
import { Delete02Icon } from "@hugeicons/core-free-icons";
import comments from "@repo/backend/confect/_generated/refs/comments";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { toast } from "@repo/design-system/lib/toast/notify";
import { Effect } from "effect";
import { useTranslations } from "use-intl";
import { useCommentDialog } from "@/components/comments/dialog";
import { removeFromLists } from "@/components/comments/mutation";
import { useRowComment } from "@/components/comments/scope";
import { reportClientException } from "@/lib/analytics/client";

/**
 * Asks before the row's comment is deleted. The comment leaves the lists at once when the learner confirms,
 * and it comes back with a message if the server refuses. The question says that the replies go with a
 * top-level comment, and that the replies to a reply go with it.
 */
export function CommentDeletion() {
  const { onOpenChange, open } = useCommentDialog("delete");
  const comment = useRowComment();
  const t = useTranslations("Comments");
  const tCommon = useTranslations("Common");
  const removeComment = useMutation(
    comments.mutations.deleteComment
  ).withOptimisticUpdate(removeFromLists);

  /** Closes the question and deletes the comment. */
  function confirm() {
    onOpenChange(false);
    Effect.runPromise(
      Effect.tryPromise(() => removeComment({ commentId: comment._id })).pipe(
        Effect.flatMap(Effect.fromResult),
        Effect.matchEffect({
          onSuccess: () => Effect.void,
          onFailure: (error) =>
            reportClientException(error, {
              source: "components/comments/delete",
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
    <ResponsiveDialog
      description={t(
        comment.threadId === undefined
          ? "delete-description"
          : "delete-reply-description"
      )}
      footer={
        <>
          <Button
            onClick={() => onOpenChange(false)}
            type="button"
            variant="outline"
          >
            {tCommon("cancel")}
          </Button>
          <Button onClick={confirm} type="button" variant="destructive">
            <HugeIcons icon={Delete02Icon} />
            {tCommon("delete")}
          </Button>
        </>
      }
      open={open}
      setOpen={onOpenChange}
      title={t("delete-title")}
    />
  );
}
