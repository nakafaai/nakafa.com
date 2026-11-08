import {
  ArrowTurnBackwardIcon,
  ArrowTurnForwardIcon,
} from "@hugeicons/core-free-icons";
import { photoOf } from "@repo/backend/confect/users/picture";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { DeferredLearnerText } from "@repo/design-system/components/markdown/deferred";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { elementById } from "@repo/design-system/lib/element";
import { lazy } from "@repo/design-system/lib/lazy";
import { ClientOnly } from "@tanstack/react-router";
import { HashSet, String as Str } from "effect";
import type { MouseEvent, ReactNode } from "react";
import { Suspense, use } from "react";
import { useLocale, useTranslations } from "use-intl";
import { isThreadShown } from "@/components/comments/draft";
import { CommentLikeButton } from "@/components/comments/like";
import { CommentMenu } from "@/components/comments/menu";
import { CommentPhotos } from "@/components/comments/photos";
import {
  useCommentDraft,
  useCommentsNow,
} from "@/components/comments/provider";
import {
  CommentsPlaceContext,
  RowCommentContext,
  useRowComment,
} from "@/components/comments/scope";
import type {
  CommentAuthor,
  CommentRow as CommentItem,
  RowComment,
} from "@/components/comments/state";
import { formatAge } from "@/components/user/age";
import {
  FeedActions,
  FeedAge,
  FeedAvatar,
  FeedBody,
  FeedHeader,
  FeedName,
  FeedRow,
} from "@/components/user/feed";
import { useWhenSignedIn } from "@/components/user/like";

/** The edit of a comment's text, which loads with the editor when its learner chooses Edit. */
const CommentEdit = lazy(() =>
  import("@/components/comments/edit").then((module) => ({
    default: module.CommentEdit,
  }))
);

/** The author a row shows: the picture and the name of the comment's writer. */
type RowAuthor = Pick<CommentAuthor, "image" | "mascot" | "name" | "picture">;

/**
 * One comment in the anatomy every row of the profile shares: the writer's picture, the name, the age and
 * whether it was edited, with the menu at the end of that line, then the text and the photos, then the
 * actions. The reply action and the line above the text belong to the place the row sits in: a thread
 * replies in place, and the profile opens the comment on its page. A row that repeats a comment above the
 * list leaves the anchor to the list's own row. While its learner edits it, the editor takes the text's place.
 * Under a page, a comment whose replies show draws the start of the thread's line down from its picture.
 */
export function CommentRow({
  author,
  comment,
  repeats = false,
  replyAction,
  replyTo,
}: {
  author: RowAuthor | null | undefined;
  comment: RowComment;
  repeats?: boolean;
  replyAction: ReactNode;
  replyTo?: ReactNode;
}) {
  const t = useTranslations("Common");
  const tComments = useTranslations("Comments");
  const locale = useLocale();
  const now = useCommentsNow();
  const saving = useCommentDraft((draft) =>
    HashSet.has(draft.saving, comment._id)
  );
  const editing = useCommentDraft((draft) => draft.editing === comment._id);
  const place = use(CommentsPlaceContext);
  const threaded = useCommentDraft(
    (draft) => place === "page" && !repeats && isThreadShown(draft, comment)
  );

  return (
    <div id={repeats ? undefined : comment._id}>
      <FeedRow rule={place === "profile"}>
        <div className="flex flex-col items-center self-stretch">
          <FeedAvatar mascot={author?.mascot} photo={photoOf(author ?? {})} />
          {threaded ? (
            <span
              aria-hidden="true"
              className="bg-border mt-1 -mb-4 w-px flex-1"
            />
          ) : null}
        </div>
        <RowCommentContext value={comment}>
          <FeedBody>
            <FeedHeader>
              <FeedName>{author?.name ?? t("anonymous")}</FeedName>
              <FeedAge at={comment._creationTime}>
                {formatAge(comment._creationTime, now, locale)}
              </FeedAge>
              {comment.editedAt === undefined ? null : (
                <span className="text-muted-foreground shrink-0">
                  {tComments("edited")}
                </span>
              )}
              <CommentMenu />
            </FeedHeader>
            {replyTo}
            {editing ? (
              <Suspense fallback={<RowText />}>
                <ClientOnly fallback={<RowText />}>
                  <CommentEdit />
                </ClientOnly>
              </Suspense>
            ) : (
              <RowText />
            )}
            <CommentPhotos />
            <FeedActions inert={saving || editing}>
              <CommentLikeButton />
              {replyAction}
            </FeedActions>
          </FeedBody>
        </RowCommentContext>
      </FeedRow>
    </div>
  );
}

/** The text of the row's comment, drawn as learner text, and nothing for a comment of photos alone. */
function RowText() {
  const comment = useRowComment();
  if (Str.isEmpty(comment.text)) {
    return null;
  }
  return <DeferredLearnerText>{comment.text}</DeferredLearnerText>;
}

/**
 * The reply control of a comment, which opens the reply composer under its thread, with the focus in it and
 * the thread's replies shown. A visitor goes to sign in first.
 */
export function ReplyButton({ comment }: { comment: CommentItem }) {
  const t = useTranslations("Common");
  const whenSignedIn = useWhenSignedIn();
  const open = useCommentDraft((draft) => draft.open);

  return (
    <Button
      onClick={() => whenSignedIn(() => open(comment))}
      size="sm"
      variant="ghost"
    >
      <HugeIcons icon={ArrowTurnBackwardIcon} />
      {t("reply")}
    </Button>
  );
}

/** The line above a reply to a reply, which names the learner it answers and jumps to that comment. */
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
      className="text-muted-foreground hover:text-foreground flex min-w-0 items-center gap-1 text-xs transition-colors ease-out"
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
  elementById(commentId)?.scrollIntoView({
    behavior: "smooth",
    block: "center",
  });
}
