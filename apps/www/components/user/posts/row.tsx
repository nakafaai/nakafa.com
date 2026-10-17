"use client";

import { useMutation } from "@confect/react";
import {
  Delete02Icon,
  FavouriteIcon,
  MoreHorizontalIcon,
} from "@hugeicons/core-free-icons";
import posts from "@repo/backend/confect/_generated/refs/posts";
import { photoOf } from "@repo/backend/confect/users/picture";
import { LearnerText } from "@repo/design-system/components/markdown/learner";
import { Button } from "@repo/design-system/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { NumberFormat } from "@repo/design-system/components/ui/number-flow";
import { toast } from "@repo/design-system/lib/toast/notify";
import { cn } from "cn";
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
 * author's picture, the name and the age with the author's More menu at the end
 * of that line, the text, and the like. The actions of a post that the server is
 * still saving are held back, because the server does not know its placeholder
 * id.
 */
export function PostRow({ post }: { post: ListPost }) {
  const locale = useLocale();
  // The rows show the profile's own account, never the signed-in viewer, so a
  // row does not depend on who is looking at it.
  const { account, author } = usePostsContext();
  const now = usePostsNow();
  const pending = usePostDraft((draft) => draft.savingPostId === post._id);
  return (
    <FeedRow>
      <FeedAvatar
        mascot={account.appUser.mascot}
        photo={photoOf(account.appUser)}
      />
      <FeedBody>
        <FeedHeader>
          <FeedName>{account.authUser.name}</FeedName>
          <FeedAge at={post._creationTime}>
            {formatShortAge(post._creationTime, now, locale)}
          </FeedAge>
          {author !== null && (
            <FeedEnd>
              <PostMoreMenu inert={pending} postId={post._id} />
            </FeedEnd>
          )}
        </FeedHeader>
        <LearnerText>{post.text}</LearnerText>
        <FeedActions inert={pending}>
          <PostLikeButton post={post} />
        </FeedActions>
      </FeedBody>
    </FeedRow>
  );
}

/**
 * The like toggle of a post, at its own width: the heart, and the count once it
 * is above zero. The change is made at once and the server answers after it.
 * The ghost variant recolors the icon on hover, so a liked heart keeps its color
 * with a rule of its own.
 */
function PostLikeButton({ post }: { post: ListPost }) {
  const t = useTranslations("Common");
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
    <Button
      aria-label={t("like")}
      aria-pressed={post.liked}
      className={cn(post.liked && "hover:[&_svg]:text-destructive")}
      onClick={toggle}
      size="sm"
      variant="ghost"
    >
      <HugeIcons
        className={cn(post.liked && "text-destructive [&_path]:fill-current")}
        icon={FavouriteIcon}
      />
      {post.likeCount > 0 && (
        <NumberFormat
          className="text-xs tabular-nums"
          format={{ notation: "compact", maximumFractionDigits: 1 }}
          isolate={true}
          value={post.likeCount}
        />
      )}
    </Button>
  );
}

/**
 * The menu of the author's own post. The delete dialog mounts with the first
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
