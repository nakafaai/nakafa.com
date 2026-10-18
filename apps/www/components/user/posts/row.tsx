"use client";

import { useMutation } from "@confect/react";
import { Delete02Icon, MoreHorizontalIcon } from "@hugeicons/core-free-icons";
import posts from "@repo/backend/confect/_generated/refs/posts";
import { DeferredLearnerText } from "@repo/design-system/components/markdown/learner.client";
import { Button } from "@repo/design-system/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { toast } from "@repo/design-system/lib/toast/notify";
import { Effect } from "effect";
import dynamic from "next/dynamic";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
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
const PostDeletion = dynamic(
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
  const pending = usePostDraft((draft) => draft.savingPostId === post._id);
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
              <PostMoreMenu inert={pending} postId={post._id} />
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

/**
 * The menu of the owner's own post. The delete dialog mounts with the first
 * opening of the menu, so its code is loaded before Delete can be chosen.
 */
function PostMoreMenu({
  inert,
  postId,
}: {
  inert: boolean;
  postId: ListPost["_id"];
}) {
  const t = useTranslations("Common");
  const [menuOpened, setMenuOpened] = useState(false);
  const [deleting, setDeleting] = useState(false);

  return (
    <>
      <DropdownMenu
        onOpenChange={(open) => {
          if (open) {
            setMenuOpened(true);
          }
        }}
      >
        <DropdownMenuTrigger
          render={
            <Button
              aria-label={t("more")}
              inert={inert}
              size="icon-sm"
              variant="ghost"
            >
              <HugeIcons icon={MoreHorizontalIcon} />
              <span className="sr-only">{t("more")}</span>
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem
            className="cursor-pointer"
            onClick={() => setDeleting(true)}
            variant="destructive"
          >
            <HugeIcons icon={Delete02Icon} />
            {t("delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {menuOpened && (
        <PostDeletion
          onOpenChange={setDeleting}
          open={deleting}
          postId={postId}
        />
      )}
    </>
  );
}
