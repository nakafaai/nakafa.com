import { PaginatedQueryResult, usePaginatedQuery } from "@confect/react";
import { ArrowDown01Icon, ArrowUp01Icon } from "@hugeicons/core-free-icons";
import comments from "@repo/backend/confect/_generated/refs/comments";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Intersection } from "@repo/design-system/components/ui/intersection";
import { cva } from "class-variance-authority";
import { Array as Arr, HashSet } from "effect";
import type { ReactNode } from "react";
import { useTranslations } from "use-intl";
import { CommentComposer } from "@/components/comments/composer";
import { isThreadShown } from "@/components/comments/draft";
import { useCommentDraft } from "@/components/comments/provider";
import { CommentRow, ReplyButton, ReplyingTo } from "@/components/comments/row";
import { ComposerAnswersContext } from "@/components/comments/scope";
import {
  type CommentRow as CommentRowData,
  threadOf,
} from "@/components/comments/state";
import { DataFailure } from "@/components/shared/failure";

/** How many replies a page of a thread holds, the first one and each one after it. */
const REPLY_PAGE_SIZE = 20;

/**
 * One branch of a thread, from the line that comes down from the comment's picture: an L that turns into
 * the branch at the height of its picture, and the line going on past it to the next branch. The last
 * branch ends the line at its L, as the sketch of a thread draws it.
 */
const branchVariants = cva(
  "relative ms-5 ps-8 before:absolute before:start-0 before:top-0 before:h-9 before:w-6 before:rounded-es-xl before:border-s before:border-b",
  {
    defaultVariants: { last: false },
    variants: {
      last: {
        false:
          "after:absolute after:start-0 after:top-0 after:bottom-0 after:border-s",
        true: "",
      },
    },
  }
);

/** The row of a thread's toggle: at the replies' indent, crossed by the thread's line once the replies show. */
const toggleVariants = cva("", {
  variants: { shown: { false: "ps-13", true: "ms-5 border-s ps-8" } },
});

/** One branch of a thread, with the line drawn to it. */
function ThreadBranch({
  children,
  last = false,
}: {
  children: ReactNode;
  last?: boolean;
}) {
  return <div className={branchVariants({ last })}>{children}</div>;
}

/**
 * The thread under a top-level comment, one level deep as a video's: a toggle that names how many replies
 * it holds and opens them, then each reply, oldest first, joined to the comment by the thread's line, and
 * the reply composer when one is open in this thread. A reply to a reply stays in the thread and names the
 * learner it answers. A thread with no replies and no open composer shows nothing.
 */
export function CommentThread({ comment }: { comment: CommentRowData }) {
  const shown = useCommentDraft((draft) => isThreadShown(draft, comment));
  if (comment.replyCount === 0 && !shown) {
    return null;
  }
  return (
    <>
      <ThreadToggle comment={comment} shown={shown} />
      {shown ? <ThreadReplies threadId={comment._id} /> : null}
    </>
  );
}

/** The toggle of a thread's replies, under the comment's actions, which the line passes once they show. */
function ThreadToggle({
  comment,
  shown,
}: {
  comment: CommentRowData;
  shown: boolean;
}) {
  const t = useTranslations("Comments");
  const toggle = useCommentDraft((draft) => draft.toggleThread);
  const expanded = useCommentDraft((draft) =>
    HashSet.has(draft.expanded, comment._id)
  );
  if (comment.replyCount === 0) {
    return null;
  }
  return (
    <div className={toggleVariants({ shown })}>
      <Button
        aria-expanded={expanded}
        className="text-primary -ms-2.5"
        onClick={() => toggle(comment._id)}
        size="sm"
        variant="ghost"
      >
        <HugeIcons icon={expanded ? ArrowUp01Icon : ArrowDown01Icon} />
        {t(expanded ? "replies-hide" : "replies", {
          count: comment.replyCount,
        })}
      </Button>
    </div>
  );
}

/** The loaded replies of one thread, a page at a time, and the composer at their end. */
function ThreadReplies({ threadId }: { threadId: CommentRowData["_id"] }) {
  const pagination = usePaginatedQuery(
    comments.queries.getCommentReplies,
    { threadId },
    { initialNumItems: REPLY_PAGE_SIZE }
  );
  const target = useCommentDraft((draft) => draft.target);
  const composing = target !== null && threadOf(target) === threadId;
  const more = PaginatedQueryResult.isCanLoadMore(pagination);

  return (
    <>
      {PaginatedQueryResult.isFailure(pagination) ? (
        <ThreadBranch>
          <DataFailure />
        </ThreadBranch>
      ) : null}
      {Arr.map(pagination.results, (reply, index) => (
        <ThreadBranch
          key={reply._id}
          last={!(composing || more) && index === pagination.results.length - 1}
        >
          <CommentRow
            author={reply.user}
            comment={reply}
            replyAction={<ReplyButton comment={reply} />}
            replyTo={
              reply.parentId === undefined ||
              reply.parentId === threadId ||
              reply.replyToUser === null ? undefined : (
                <ReplyingTo
                  name={reply.replyToUser.name}
                  parentId={reply.parentId}
                />
              )
            }
          />
        </ThreadBranch>
      ))}
      {more ? (
        <Intersection
          onIntersect={() => pagination.loadMore(REPLY_PAGE_SIZE)}
        />
      ) : null}
      {composing ? (
        <ThreadBranch last>
          <div className="py-3">
            <ComposerAnswersContext value={target}>
              <CommentComposer />
            </ComposerAnswersContext>
          </div>
        </ThreadBranch>
      ) : null}
    </>
  );
}
