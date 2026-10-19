"use client";

import { useMutation } from "@confect/react";
import { Delete02Icon } from "@hugeicons/core-free-icons";
import posts from "@repo/backend/confect/_generated/refs/posts";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { toast } from "@repo/design-system/lib/toast/notify";
import { Effect } from "effect";
import { useTranslations } from "use-intl";
import { useDeletion } from "@/components/shared/more";
import { removeFromLists } from "@/components/user/posts/mutation.client";
import type { ListPost } from "@/components/user/posts/state";
import { reportClientException } from "@/lib/analytics/client";

/**
 * Asks before a post is deleted. The post leaves the list at once when the
 * learner confirms, and it comes back with a message if the server refuses.
 */
export function PostDeletion({ postId }: { postId: ListPost["_id"] }) {
  const { onOpenChange, open } = useDeletion();
  const t = useTranslations("Posts");
  const tCommon = useTranslations("Common");
  const removePost = useMutation(posts.mutations.remove).withOptimisticUpdate(
    removeFromLists
  );

  /** Closes the question and deletes the post. */
  function confirm() {
    onOpenChange(false);
    Effect.runPromise(
      Effect.tryPromise(() => removePost({ postId })).pipe(
        Effect.flatMap(Effect.fromResult),
        Effect.matchEffect({
          onSuccess: () => Effect.void,
          onFailure: (error) =>
            reportClientException(error, {
              source: "components/user/posts/delete",
            }).pipe(
              Effect.andThen(
                Effect.sync(() => {
                  toast.error({
                    title: "action-error.title",
                    description: "action-error.description",
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
      description={t("delete-description")}
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
