"use client";

import { Delete02Icon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { Effect } from "effect";
import { useTranslations } from "next-intl";
import { startTransition } from "react";
import { toast } from "sonner";
import { useRemovePostMutation } from "@/components/user/posts/mutation.client";
import type { ListPost } from "@/components/user/posts/state";
import { reportClientException } from "@/lib/analytics/client";

/**
 * Asks before a post is deleted. The post leaves the list at once when the
 * learner confirms, and it comes back with a message if the server refuses.
 */
export function PostDeletion({
  postId,
  open,
  onOpenChange,
}: {
  postId: ListPost["_id"];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("Posts");
  const tCommon = useTranslations("Common");
  const removePost = useRemovePostMutation();

  /** Closes the question and deletes the post. */
  function confirm() {
    onOpenChange(false);
    startTransition(() =>
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
                    toast.error(tCommon("action-error"));
                  })
                )
              ),
          })
        )
      )
    );
  }

  return (
    <ResponsiveDialog
      description={t("delete-description")}
      footer={
        <Button onClick={confirm} variant="destructive">
          <HugeIcons icon={Delete02Icon} />
          {tCommon("delete")}
        </Button>
      }
      open={open}
      setOpen={onOpenChange}
      title={t("delete-title")}
    />
  );
}
