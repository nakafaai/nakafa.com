"use client";

import {
  Delete02Icon,
  FavouriteIcon,
  MoreHorizontalIcon,
} from "@hugeicons/core-free-icons";
import { photoOf } from "@repo/backend/confect/users/picture";
import { Button } from "@repo/design-system/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { PersonAvatar } from "@repo/design-system/components/ui/person";
import { cn } from "cn";
import { DateTime, Effect } from "effect";
import { useLocale, useTranslations } from "next-intl";
import { startTransition, useState } from "react";
import { toast } from "sonner";
import { PostDeletion } from "@/components/user/posts/delete";
import {
  useLikePostMutation,
  useUnlikePostMutation,
} from "@/components/user/posts/mutation.client";
import type { ListPost } from "@/components/user/posts/state";
import { formatPostAge } from "@/components/user/posts/time";
import { reportClientException } from "@/lib/analytics/client";
import type { CurrentUser } from "@/lib/identity/client";

/**
 * One post of the list: the author's picture with a line down to the next post,
 * the author's name and the age of the post, the text, and the actions of the
 * post. Only the author sees the More menu.
 */
export function PostRow({
  author,
  isAuthor,
  isLast,
  now,
  post,
}: {
  author: CurrentUser;
  isAuthor: boolean;
  isLast: boolean;
  now: number;
  post: ListPost;
}) {
  const locale = useLocale();
  return (
    <article
      className={cn("flex gap-3 py-4", !isLast && "border-b")}
      data-slot="post-row"
    >
      <div className="flex shrink-0 flex-col items-center gap-2">
        <PersonAvatar
          className="size-10"
          mascot={author.appUser.mascot}
          photo={photoOf(author.appUser)}
        />
        {!isLast && <span aria-hidden className="w-px grow bg-border" />}
      </div>
      <div className="grid min-w-0 flex-1 gap-1">
        <div className="flex min-w-0 items-baseline gap-2 text-sm">
          <span className="truncate font-medium">{author.authUser.name}</span>
          <time
            className="shrink-0 text-muted-foreground"
            dateTime={DateTime.formatIso(
              DateTime.makeUnsafe(post._creationTime)
            )}
          >
            {formatPostAge(post._creationTime, now, locale)}
          </time>
        </div>
        <p
          className="wrap-break-word whitespace-pre-wrap text-pretty"
          dir="auto"
        >
          {post.text}
        </p>
        <div className="flex -translate-x-2 items-center">
          <PostLikeButton post={post} />
          {isAuthor && <PostMoreMenu postId={post._id} />}
        </div>
      </div>
    </article>
  );
}

/** The like toggle of a post, with its count once the count is above zero. */
function PostLikeButton({ post }: { post: ListPost }) {
  const t = useTranslations("Common");
  const like = useLikePostMutation();
  const unlike = useUnlikePostMutation();

  /** Likes or unlikes the post, and tells the learner when the server refuses. */
  function toggle() {
    const change = post.liked ? unlike : like;
    startTransition(() =>
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
                    toast.error(t("action-error"));
                  })
                )
              ),
          })
        )
      )
    );
  }

  return (
    <Button
      aria-label={t("like")}
      aria-pressed={post.liked}
      className="gap-1.5"
      onClick={toggle}
      size="sm"
      variant="ghost"
    >
      <HugeIcons
        className={cn(post.liked && "text-destructive [&_path]:fill-current")}
        icon={FavouriteIcon}
      />
      {post.likeCount > 0 && (
        <span className="text-xs tabular-nums">{post.likeCount}</span>
      )}
    </Button>
  );
}

/** The menu of the author's own post, which asks before it deletes the post. */
function PostMoreMenu({ postId }: { postId: ListPost["_id"] }) {
  const t = useTranslations("Common");
  const [deleting, setDeleting] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button aria-label={t("more")} size="icon-sm" variant="ghost">
              <HugeIcons icon={MoreHorizontalIcon} />
              <span className="sr-only">{t("more")}</span>
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem
            className="cursor-pointer"
            onClick={() => setDeleting(true)}
          >
            <HugeIcons icon={Delete02Icon} />
            {t("delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <PostDeletion
        onOpenChange={setDeleting}
        open={deleting}
        postId={postId}
      />
    </>
  );
}
