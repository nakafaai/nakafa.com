"use client";

import { useMutation } from "@confect/react";
import { Id } from "@repo/backend/confect/_generated/id";
import comments from "@repo/backend/confect/_generated/refs/comments";
import { toast } from "@repo/design-system/lib/toast/notify";
import { randomUuid } from "@repo/utilities/uuid";
import { DateTime, Effect, Schema, Struct } from "effect";
import {
  insertDraftComment,
  insertDraftReply,
} from "@/components/comments/mutation.client";
import { useCommentDraft } from "@/components/comments/provider";
import {
  type CommentAuthor,
  type CommentRow,
  draftComment,
  threadOf,
} from "@/components/comments/state";
import { reportClientException } from "@/lib/analytics/client";
import { useViewer } from "@/lib/identity/client";

/**
 * Returns the function that posts a comment or a reply. The comment shows at once
 * where it will sit, and the server answers after it; until then its row holds its
 * actions back, because the server does not know its placeholder id. A refused post shows its
 * message, and the composer gives the text back, so the resolved value says whether
 * the server saved it.
 */
export function usePostComment() {
  const viewer = useViewer((state) => state.account);
  const addComment = useMutation(comments.mutations.addComment);
  const startSaving = useCommentDraft((draft) => draft.startSaving);
  const finishSaving = useCommentDraft((draft) => draft.finishSaving);

  return function postComment(post: {
    /** The comment the post answers, or none for a top-level comment. */
    readonly parent: CommentRow | null;
    readonly slug: string;
    readonly text: string;
  }): Promise<boolean> {
    if (!viewer) {
      return Effect.runPromise(Effect.succeed(false));
    }
    const author: CommentAuthor = {
      _id: viewer.appUser._id,
      image: viewer.authUser.image ?? null,
      name: viewer.authUser.name,
      ...Struct.pick(viewer.appUser, ["mascot", "picture"]),
    };
    return Effect.runPromise(
      randomUuid.pipe(
        // The placeholder id of a comment the server has not saved yet. The
        // mutation never sends it, and the saved comment replaces it in the list.
        Effect.flatMap((uuid) =>
          Schema.decodeUnknownEffect(Id("comments"))(uuid).pipe(Effect.orDie)
        ),
        Effect.flatMap((id) => {
          const draft = draftComment(author, post.parent, {
            _creationTime: DateTime.toEpochMillis(DateTime.nowUnsafe()),
            _id: id,
            slug: post.slug,
            text: post.text,
          });
          const save = addComment.withOptimisticUpdate(
            post.parent === null
              ? insertDraftComment(draft)
              : insertDraftReply(draft, threadOf(post.parent))
          );
          return Effect.sync(() => startSaving(id)).pipe(
            Effect.andThen(
              Effect.tryPromise(() =>
                save({
                  slug: post.slug,
                  text: post.text,
                  ...(post.parent === null
                    ? {}
                    : { parentId: post.parent._id }),
                })
              )
            ),
            Effect.flatMap(Effect.fromResult),
            Effect.ensuring(Effect.sync(() => finishSaving(id)))
          );
        }),
        Effect.matchEffect({
          onSuccess: () => Effect.succeed(true),
          onFailure: (error) =>
            reportClientException(error, {
              source: "components/comments/posting",
            }).pipe(
              Effect.andThen(
                Effect.sync(() => {
                  toast.error({
                    description: "action-error.description",
                    title: "action-error.title",
                  });
                })
              ),
              Effect.as(false)
            ),
        })
      )
    );
  };
}
