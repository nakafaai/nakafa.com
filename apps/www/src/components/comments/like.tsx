import { useMutation } from "@confect/react";
import comments from "@repo/backend/confect/_generated/refs/comments";
import { toast } from "@repo/design-system/lib/toast/notify";
import { Effect } from "effect";
import { likeInLists, unlikeInLists } from "@/components/comments/mutation";
import { useRowComment } from "@/components/comments/scope";
import { ConvexIsland } from "@/components/providers/island";
import { FeedCount } from "@/components/user/feed";
import { LikeButton, useWhenSignedIn } from "@/components/user/like";
import { reportClientException } from "@/lib/analytics/client";

/**
 * The like toggle of the row's comment. A learner's toggle changes it through the page's client, and a
 * visitor's toggle sends the visitor to sign in.
 */
export function CommentLikeButton() {
  return (
    <ConvexIsland fallback={<VisitorCommentLikeButton />}>
      <LiveCommentLikeButton />
    </ConvexIsland>
  );
}

/** A visitor's like toggle: it asks for sign-in, and changes nothing. */
function VisitorCommentLikeButton() {
  const comment = useRowComment();
  const whenSignedIn = useWhenSignedIn();
  return (
    <LikeButton
      liked={comment.liked}
      onToggle={() => whenSignedIn(() => undefined)}
    >
      <FeedCount value={comment.likeCount} />
    </LikeButton>
  );
}

/** A learner's like toggle, which changes the comment at once and puts it back when the server refuses. */
function LiveCommentLikeButton() {
  const comment = useRowComment();
  const like = useMutation(comments.mutations.likeComment).withOptimisticUpdate(
    likeInLists
  );
  const unlike = useMutation(
    comments.mutations.unlikeComment
  ).withOptimisticUpdate(unlikeInLists);

  /** Likes or unlikes the comment, and tells the learner when the server refuses. */
  function toggle() {
    const change = comment.liked ? unlike : like;
    Effect.runPromise(
      Effect.tryPromise(() => change({ commentId: comment._id })).pipe(
        Effect.flatMap(Effect.fromResult),
        Effect.matchEffect({
          onSuccess: () => Effect.void,
          onFailure: (error) =>
            reportClientException(error, {
              source: "components/comments/like",
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
    <LikeButton liked={comment.liked} onToggle={toggle}>
      <FeedCount value={comment.likeCount} />
    </LikeButton>
  );
}
