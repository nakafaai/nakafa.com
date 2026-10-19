"use client";

import { useMutation } from "@confect/react";
import {
  ArrowTurnBackwardIcon,
  ArrowTurnForwardIcon,
} from "@hugeicons/core-free-icons";
import comments from "@repo/backend/confect/_generated/refs/comments";
import { photoOf } from "@repo/backend/confect/users/picture";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { DeferredLearnerText } from "@repo/design-system/components/markdown/learner.client";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { toast } from "@repo/design-system/lib/toast/notify";
import { Effect, HashSet } from "effect";
import dynamic from "next/dynamic";
import type { MouseEvent, ReactNode } from "react";
import { useLocale, useTranslations } from "use-intl";
import {
  likeInLists,
  unlikeInLists,
} from "@/components/comments/mutation.client";
import {
  useCommentDraft,
  useCommentsNow,
} from "@/components/comments/provider";
import type {
  CommentAuthor,
  CommentRow as CommentItem,
} from "@/components/comments/state";
import { MoreMenu } from "@/components/shared/more";
import { formatShortAge } from "@/components/user/age";
import {
  FeedActions,
  FeedAge,
  FeedAvatar,
  FeedBody,
  FeedCount,
  FeedEnd,
  FeedHeader,
  FeedName,
  FeedRow,
} from "@/components/user/feed";
import { LikeButton, useWhenSignedIn } from "@/components/user/like";
import { reportClientException } from "@/lib/analytics/client";
import { useViewer } from "@/lib/identity/client";

/** The delete dialog loads when the learner opens the More menu of a comment, before they can choose Delete. */
const CommentDeletion = dynamic(
  () =>
    import("@/components/comments/delete").then(
      (module) => module.CommentDeletion
    ),
  { loading: () => null, ssr: false }
);

/** The fields of a comment that a row shows and acts on: a top-level comment, a reply, and a profile's comment all carry them. */
type RowComment = Pick<
  CommentItem,
  | "_creationTime"
  | "_id"
  | "liked"
  | "likeCount"
  | "replyCount"
  | "text"
  | "threadId"
  | "userId"
>;

/** The author a row shows: the picture and the name of the comment's writer. */
type RowAuthor = Pick<CommentAuthor, "image" | "mascot" | "name" | "picture">;

/**
 * One comment in the anatomy every row of the profile shares: the writer's picture,
 * the name and the age with the More menu at the end of that line, the text, then the
 * actions. The reply action and the line above the text belong to the place the row
 * sits in: a thread replies in place, and the profile opens the comment on its page.
 */
export function CommentRow({
  author,
  comment,
  replyAction,
  replyTo,
}: {
  author: RowAuthor | null | undefined;
  comment: RowComment;
  replyAction: ReactNode;
  replyTo?: ReactNode;
}) {
  const t = useTranslations("Common");
  const locale = useLocale();
  const now = useCommentsNow();
  const saving = useCommentDraft((draft) =>
    HashSet.has(draft.saving, comment._id)
  );
  const viewerId = useViewer((state) => state.account?.appUser._id);
  return (
    <div id={comment._id}>
      <FeedRow>
        <FeedAvatar mascot={author?.mascot} photo={photoOf(author ?? {})} />
        <FeedBody>
          <FeedHeader>
            <FeedName>{author?.name ?? t("anonymous")}</FeedName>
            <FeedAge at={comment._creationTime}>
              {formatShortAge(comment._creationTime, now, locale)}
            </FeedAge>
            {viewerId === comment.userId && (
              <FeedEnd>
                <MoreMenu inert={saving}>
                  <CommentDeletion
                    commentId={comment._id}
                    isReply={comment.threadId !== undefined}
                  />
                </MoreMenu>
              </FeedEnd>
            )}
          </FeedHeader>
          {replyTo}
          <DeferredLearnerText>{comment.text}</DeferredLearnerText>
          <FeedActions inert={saving}>
            <CommentLikeButton comment={comment} />
            {replyAction}
          </FeedActions>
        </FeedBody>
      </FeedRow>
    </div>
  );
}

/** The like toggle of a comment, which changes it at once and tells the learner when the server refuses. */
function CommentLikeButton({ comment }: { comment: RowComment }) {
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
              source: "components/comments/row",
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
    <LikeButton
      likeCount={comment.likeCount}
      liked={comment.liked}
      onToggle={toggle}
    />
  );
}

/**
 * The reply control of a comment, which opens the reply composer under its thread,
 * with the focus in it. It shows the thread's count when it is given one, which only a
 * top-level comment carries.
 */
export function ReplyButton({
  comment,
  count,
}: {
  comment: CommentItem;
  count: number | null;
}) {
  const t = useTranslations("Common");
  const whenSignedIn = useWhenSignedIn();
  const open = useCommentDraft((draft) => draft.open);

  return (
    <Button
      aria-label={t("reply")}
      onClick={() => whenSignedIn(() => open(comment))}
      size="sm"
      variant="ghost"
    >
      <HugeIcons icon={ArrowTurnBackwardIcon} />
      {count === null ? null : <FeedCount value={count} />}
    </Button>
  );
}

/** The line above a reply to a reply, which names the comment it answers and jumps to it. */
export function ReplyingTo({
  name,
  parentId,
}: {
  name: string;
  parentId: Id<"comments">;
}) {
  const t = useTranslations("Comments");
  return (
    <a
      className="flex min-w-0 items-center gap-1 text-muted-foreground text-xs transition-colors ease-out hover:text-foreground"
      href={`#${parentId}`}
      onClick={(event) => scrollToComment(event, parentId)}
    >
      <HugeIcons className="size-3 shrink-0" icon={ArrowTurnForwardIcon} />
      <span className="min-w-0 truncate">{t("replying-to", { name })}</span>
    </a>
  );
}

/** Scrolls the comment with this id into the middle of the viewport. */
function scrollToComment(
  event: MouseEvent<HTMLAnchorElement>,
  commentId: Id<"comments">
) {
  event.preventDefault();
  document.getElementById(commentId)?.scrollIntoView({
    behavior: "smooth",
    block: "center",
  });
}
