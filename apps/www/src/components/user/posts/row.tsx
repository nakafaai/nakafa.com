"use client";

import { useMutation } from "@confect/react";
import posts from "@repo/backend/confect/_generated/refs/posts";
import { DeferredLearnerText } from "@repo/design-system/components/markdown/learner.client";
import { lazyComponent } from "@repo/design-system/lib/lazy";
import { toast } from "@repo/design-system/lib/toast/notify";
import { Effect, HashSet } from "effect";
import { useLocale } from "use-intl";
import { MoreMenu } from "@/components/shared/more";
import { formatShortAge } from "@/components/user/age";
import {
  FeedActions,
  FeedAge,
  FeedAvatar,
  FeedBody,
  FeedEnd,
  FeedHeader,
  FeedName,
  FeedRow,
} from "@/components/user/feed";
import { LikeButton } from "@/components/user/like";
import {
  likeInLists,
  unlikeInLists,
} from "@/components/user/posts/mutation.client";
import {
  usePostDraft,
  usePostsContext,
  usePostsNow,
} from "@/components/user/posts/provider";
import type { ListPost } from "@/components/user/posts/state";
import { reportClientException } from "@/lib/analytics/client";

/** The delete dialog loads when the learner opens the More menu of a post, before they can choose Delete. */
const PostDeletion = lazyComponent(
  () =>
    import("@/components/user/posts/delete").then(
      (module) => module.PostDeletion
    ),
  { loading: () => null, ssr: false }
);

/**
 * One post of the list, in the anatomy every row of the profile shares: the
 * profile's picture, its name and the age, with the owner's More menu at the end
 * of that line, the text, and the like. The actions of a post that the server is
 * still saving are held back, because the server does not know its placeholder
 * id.
 */
export function PostRow({ post }: { post: ListPost }) {
  const locale = useLocale();
  // The rows show the profile, whoever is looking at them.
  const { isOwner, profile } = usePostsContext();
  const now = usePostsNow();
  const pending = usePostDraft((draft) => HashSet.has(draft.saving, post._id));
  return (
    <FeedRow>
      <FeedAvatar mascot={profile.mascot} photo={profile.image} />
      <FeedBody>
        <FeedHeader>
          <FeedName>{profile.name}</FeedName>
          <FeedAge at={post._creationTime}>
            {formatShortAge(post._creationTime, now, locale)}
          </FeedAge>
          {isOwner && (
            <FeedEnd>
              <MoreMenu inert={pending}>
                <PostDeletion postId={post._id} />
              </MoreMenu>
            </FeedEnd>
          )}
        </FeedHeader>
        <DeferredLearnerText>{post.text}</DeferredLearnerText>
        <FeedActions inert={pending}>
          <PostLikeButton post={post} />
        </FeedActions>
      </FeedBody>
    </FeedRow>
  );
}

/** The like toggle of a post, which changes the post at once and tells the learner when the server refuses. */
function PostLikeButton({ post }: { post: ListPost }) {
  const like = useMutation(posts.mutations.like).withOptimisticUpdate(
    likeInLists
  );
  const unlike = useMutation(posts.mutations.unlike).withOptimisticUpdate(
    unlikeInLists
  );

  /** Likes or unlikes the post, and tells the learner when the server refuses. */
  function toggle() {
    const change = post.liked ? unlike : like;
    Effect.runPromise(
      Effect.tryPromise(() => change({ postId: post._id })).pipe(
        Effect.flatMap(Effect.fromResult),
        Effect.matchEffect({
          onSuccess: () => Effect.void,
          onFailure: (error) =>
            reportClientException(error, {
              source: "components/user/posts/row",
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
    <LikeButton
      likeCount={post.likeCount}
      liked={post.liked}
      onToggle={toggle}
    />
  );
}
