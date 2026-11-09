import { useMutation } from "@confect/react";
import { Id } from "@repo/backend/confect/_generated/id";
import comments from "@repo/backend/confect/_generated/refs/comments";
import { toast } from "@repo/design-system/lib/toast/notify";
import { randomUuid } from "@repo/utilities/uuid";
import { Array as Arr, DateTime, Effect, Schema, Struct } from "effect";
import type { TrayPhoto } from "@/components/comments/draft";
import {
  insertDraftComment,
  insertDraftReply,
} from "@/components/comments/mutation";
import { useCommentDraft } from "@/components/comments/provider";
import { useCommentsSlug } from "@/components/comments/slug";
import {
  type CommentAuthor,
  type CommentRow,
  draftComment,
  threadOf,
} from "@/components/comments/state";
import { reportClientException } from "@/lib/analytics/client";
import { useViewer } from "@/lib/identity/client";

/** The photos a post carries as its comment shows them before the server answers: each from this device. */
const shownPhotos = (photos: readonly (typeof TrayPhoto.Type)[]) =>
  Arr.map(photos, (photo) => ({
    address: photo.preview,
    height: photo.height,
    thumbnail: photo.preview,
    width: photo.width,
  }));

/**
 * Returns the function that posts a comment or a reply on the page's slug. The comment shows at once where
 * it will sit, with its photos from this device, and the page's count moves with it; the server answers after
 * it, and until then its row holds its actions back, because the server does not know its placeholder id. A
 * refused post takes the comment back out and shows its message, and the resolved value says whether the
 * server saved it, so the composer can give the words and the photos back.
 */
export function usePostComment() {
  const viewer = useViewer((state) => state.account);
  const slug = useCommentsSlug();
  const addComment = useMutation(comments.mutations.addComment);
  const startSaving = useCommentDraft((draft) => draft.startSaving);
  const finishSaving = useCommentDraft((draft) => draft.finishSaving);

  return function postComment(post: {
    /** The comment the post answers, or none for a top-level comment. */
    readonly parent: CommentRow | null;
    /** The uploaded photos the comment carries. */
    readonly photos: readonly (typeof TrayPhoto.Type)[];
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
    const uploads = Arr.getSomes(Arr.map(post.photos, (photo) => photo.upload));
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
            photos: shownPhotos(post.photos),
            slug,
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
                  slug,
                  text: post.text,
                  uploads,
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
          onSuccess: () =>
            Effect.sync(() => {
              Arr.forEach(post.photos, (photo) =>
                URL.revokeObjectURL(photo.preview)
              );
              return true;
            }),
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
