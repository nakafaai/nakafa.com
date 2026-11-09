import type { Ref } from "@confect/core";
import type { OptimisticUpdate } from "@confect/react";
import type * as OptimisticLocalStore from "@confect/react/OptimisticLocalStore";
import comments from "@repo/backend/confect/_generated/refs/comments";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Array as Arr, Option } from "effect";
import {
  type CommentRow,
  changeComment,
  commentAndReplyIds,
  countReplies,
  type ListedComment,
  likedComment,
  removeComments,
  unlikedComment,
} from "@/components/comments/state";

/** The queries that list comments: the top-level comments of a slug, the replies of a thread, and a profile's comments. */
type CommentListRef =
  | typeof comments.queries.getCommentsBySlug
  | typeof comments.queries.getCommentReplies
  | typeof comments.queries.getCommentsByUserId;

/** The page of a loaded comment list, as the list holds it. */
type PageOf<Q extends CommentListRef> = Ref.Returns<Q>["page"];

/** Changes the page of every loaded list of one query, so each open list shows the change. */
function changeLists<Q extends CommentListRef>(
  localStore: OptimisticLocalStore.OptimisticLocalStore,
  ref: Q,
  change: (page: PageOf<Q>) => PageOf<Q>
) {
  for (const query of localStore.getAllQueries(ref)) {
    if (Option.isSome(query.value)) {
      localStore.setQuery(
        ref,
        query.args,
        Option.some({
          ...query.value.value,
          page: change(query.value.value.page),
        })
      );
    }
  }
}

/** Changes the comment on every loaded list that holds it: the comments of a slug, a thread and a profile. */
function changeEveryList(
  localStore: OptimisticLocalStore.OptimisticLocalStore,
  commentId: Id<"comments">,
  change: <T extends ListedComment>(comment: T) => T
) {
  changeLists(localStore, comments.queries.getCommentsBySlug, (page) =>
    changeComment(page, commentId, change)
  );
  changeLists(localStore, comments.queries.getCommentReplies, (page) =>
    changeComment(page, commentId, change)
  );
  changeLists(localStore, comments.queries.getCommentsByUserId, (page) =>
    changeComment(page, commentId, change)
  );
}

/** The change that shows a like on the comment at once, on every loaded list. */
export const likeInLists: OptimisticUpdate<
  typeof comments.mutations.likeComment
> = (localStore, { commentId }) =>
  changeEveryList(localStore, commentId, likedComment);

/** The change that takes a like off the comment at once, on every loaded list. */
export const unlikeInLists: OptimisticUpdate<
  typeof comments.mutations.unlikeComment
> = (localStore, { commentId }) =>
  changeEveryList(localStore, commentId, unlikedComment);

/**
 * The change that shows a new top-level comment first in each loaded list of its
 * slug, while the server saves it. A list that is still loading its first page
 * takes no change, and the saved comment comes in with the page.
 */
export function insertDraftComment(
  draft: CommentRow
): OptimisticUpdate<typeof comments.mutations.addComment> {
  return (localStore) => {
    for (const query of localStore.getAllQueries(
      comments.queries.getCommentsBySlug
    )) {
      if (
        Option.isSome(query.value) &&
        query.args.slug === draft.slug &&
        query.args.paginationOpts.cursor === null
      ) {
        localStore.setQuery(
          comments.queries.getCommentsBySlug,
          query.args,
          Option.some({
            ...query.value.value,
            page: Arr.prepend(query.value.value.page, draft),
          })
        );
      }
    }
  };
}

/**
 * The change that shows a new reply at the end of its thread, and raises the reply
 * count of the top-level comment, while the server saves it. The reply joins the
 * last loaded page of its thread, once that page is the end of the thread.
 */
export function insertDraftReply(
  draft: CommentRow,
  threadId: Id<"comments">
): OptimisticUpdate<typeof comments.mutations.addComment> {
  return (localStore) => {
    changeLists(localStore, comments.queries.getCommentsBySlug, (page) =>
      countReplies(page, threadId, 1)
    );
    for (const query of localStore.getAllQueries(
      comments.queries.getCommentReplies
    )) {
      if (
        Option.isSome(query.value) &&
        query.args.threadId === threadId &&
        query.value.value.isDone
      ) {
        localStore.setQuery(
          comments.queries.getCommentReplies,
          query.args,
          Option.some({
            ...query.value.value,
            page: Arr.append(query.value.value.page, draft),
          })
        );
      }
    }
  };
}

/**
 * The thread of a comment as the first loaded list that holds it has it: the
 * thread id of a reply, and none for a top-level comment. None when no loaded list
 * holds the comment.
 */
function loadedThreadOf(
  localStore: OptimisticLocalStore.OptimisticLocalStore,
  commentId: Id<"comments">
): Option.Option<Pick<CommentRow, "threadId">> {
  const found = [
    ...Arr.flatMap(
      localStore.getAllQueries(comments.queries.getCommentReplies),
      (query) => (Option.isSome(query.value) ? query.value.value.page : [])
    ),
    ...Arr.flatMap(
      localStore.getAllQueries(comments.queries.getCommentsBySlug),
      (query) => (Option.isSome(query.value) ? query.value.value.page : [])
    ),
    ...Arr.flatMap(
      localStore.getAllQueries(comments.queries.getCommentsByUserId),
      (query) => (Option.isSome(query.value) ? query.value.value.page : [])
    ),
  ];
  return Arr.findFirst(found, (row) => row._id === commentId);
}

/** Every reply of a thread that is loaded, in the order of the loaded pages. */
function loadedReplies(
  localStore: OptimisticLocalStore.OptimisticLocalStore,
  threadId: Id<"comments">
) {
  return Arr.flatMap(
    localStore.getAllQueries(comments.queries.getCommentReplies),
    (query) =>
      query.args.threadId === threadId && Option.isSome(query.value)
        ? query.value.value.page
        : []
  );
}

/**
 * The change that takes a comment off every loaded list at once, as the server
 * deletes it. A top-level comment leaves with its thread, because no list shows a
 * thread without its comment. A reply leaves with the loaded replies that name it,
 * directly or through other replies, and the reply count of its thread goes down
 * by the same number.
 */
export const removeFromLists: OptimisticUpdate<
  typeof comments.mutations.deleteComment
> = (localStore, { commentId }) => {
  const found = loadedThreadOf(localStore, commentId);
  if (Option.isNone(found)) {
    return;
  }
  const threadId = found.value.threadId;
  const removed =
    threadId === undefined
      ? [commentId]
      : commentAndReplyIds(loadedReplies(localStore, threadId), commentId);
  changeLists(localStore, comments.queries.getCommentsBySlug, (page) =>
    removeComments(page, removed)
  );
  changeLists(localStore, comments.queries.getCommentsByUserId, (page) =>
    removeComments(page, removed)
  );
  changeLists(localStore, comments.queries.getCommentReplies, (page) =>
    removeComments(page, removed)
  );
  if (threadId !== undefined) {
    changeLists(localStore, comments.queries.getCommentsBySlug, (page) =>
      countReplies(page, threadId, -removed.length)
    );
  }
};
