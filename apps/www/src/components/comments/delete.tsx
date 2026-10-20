import { useMutation } from "@confect/react";
import { Delete02Icon } from "@hugeicons/core-free-icons";
import comments from "@repo/backend/confect/_generated/refs/comments";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { toast } from "@repo/design-system/lib/toast/notify";
import { Effect } from "effect";
import { useTranslations } from "use-intl";
import { removeFromLists } from "@/components/comments/mutation";
import { useDeletion } from "@/components/shared/more";
import { reportClientException } from "@/lib/analytics/client";

/**
 * Asks before a comment is deleted. The comment leaves the lists at once when the
 * learner confirms, and it comes back with a message if the server refuses. The
 * question says that the replies go with a top-level comment, and that the replies
 * to a reply go with it.
 */
export function CommentDeletion({
  commentId,
  isReply,
}: {
  commentId: Id<"comments">;
  isReply: boolean;
}) {
  const { onOpenChange, open } = useDeletion();
  const t = useTranslations("Comments");
  const tCommon = useTranslations("Common");
  const removeComment = useMutation(
    comments.mutations.deleteComment
  ).withOptimisticUpdate(removeFromLists);

  /** Closes the question and deletes the comment. */
  function confirm() {
    onOpenChange(false);
    Effect.runPromise(
      Effect.tryPromise(() => removeComment({ commentId })).pipe(
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
        isReply ? "delete-reply-description" : "delete-description"
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
