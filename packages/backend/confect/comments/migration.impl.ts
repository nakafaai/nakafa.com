import { FunctionImpl, GroupImpl } from "@confect/server";
import type { Id } from "@repo/backend/confect/_generated/id";
import refs from "@repo/backend/confect/_generated/refs";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import type commentVotesTable from "@repo/backend/confect/_generated/tables/commentVotes";
import spec, {
  type MigrationCounts,
} from "@repo/backend/confect/comments/migration.spec";
import {
  type CommentDoc,
  findComment,
  findCommentLike,
  likeCountOf,
} from "@repo/backend/confect/comments/rows";
import { threadOf } from "@repo/backend/confect/comments/thread";
import atomic from "@repo/backend/confect/middleware/atomic.impl";
import { COMMENT_VOTE_CLEANUP_BATCH_SIZE } from "@repo/backend/confect/triggers/comments/cleanup";
import { Array as Arr, Duration, Effect, Layer, Struct } from "effect";

/** How many comments one call reads, in creation order. */
const MIGRATION_PAGE = 50;

/** The counts of one call, as the spec describes them. */
type Counts = typeof MigrationCounts.Type;

/** A vote as the database holds it. */
type VoteDoc = typeof commentVotesTable.Doc.Type;

/** The counts of nothing, where every sum starts. */
const NO_COUNTS: Counts = {
  likesAdded: 0,
  linked: 0,
  orphaned: 0,
  recounted: 0,
  votesRemoved: 0,
};

/** Adds two sets of counts field by field. */
function plus(left: Counts, right: Counts): Counts {
  return {
    likesAdded: left.likesAdded + right.likesAdded,
    linked: left.linked + right.linked,
    orphaned: left.orphaned + right.orphaned,
    recounted: left.recounted + right.recounted,
    votesRemoved: left.votesRemoved + right.votesRemoved,
  };
}

/**
 * Converts one vote: an up vote becomes a like unless the learner already liked the
 * comment, and the vote row goes. Returns 1 when the vote added a like.
 */
const convertVote = Effect.fn("comments.migration.convertVote")(function* (
  vote: VoteDoc
) {
  const writer = yield* DatabaseWriter;
  const needsLike =
    vote.vote === 1 &&
    (yield* findCommentLike(vote.commentId, vote.userId)) === null;
  if (needsLike) {
    yield* writer
      .table("commentLikes")
      .insert({ commentId: vote.commentId, userId: vote.userId })
      .pipe(Effect.orDie);
  }
  yield* writer.table("commentVotes").delete(vote._id);
  return needsLike ? 1 : 0;
});

/**
 * Converts every vote of a comment, one bounded batch at a time. A converted vote row
 * is deleted, so each batch reads the rows that are left.
 */
const convertVotes: (
  commentId: Id<"comments">
) => Effect.Effect<Counts, never, DatabaseReader | DatabaseWriter> = Effect.fn(
  "comments.migration.convertVotes"
)(function* (commentId) {
  const reader = yield* DatabaseReader;
  const votes = yield* reader
    .table("commentVotes")
    .index("by_commentId_and_userId", (q) => q.eq("commentId", commentId))
    .take(COMMENT_VOTE_CLEANUP_BATCH_SIZE)
    .pipe(Effect.orDie);
  if (votes.length === 0) {
    return NO_COUNTS;
  }
  const added = yield* Effect.forEach(votes, convertVote);
  const rest = yield* convertVotes(commentId);
  return plus(rest, {
    ...NO_COUNTS,
    likesAdded: Arr.reduce(added, 0, (total, count) => total + count),
    votesRemoved: votes.length,
  });
});

/**
 * Links one comment into its thread, converts its votes and sets its like count.
 * The comment is written only when one of those changed, or when it has no count yet.
 */
const relinkComment = Effect.fn("comments.migration.relinkComment")(function* (
  comment: CommentDoc
) {
  const writer = yield* DatabaseWriter;
  const parent =
    comment.parentId === undefined
      ? null
      : yield* findComment(comment.parentId);
  const orphaned = comment.parentId !== undefined && parent === null;
  const parentId = orphaned ? undefined : comment.parentId;
  const threadId = parent === null ? undefined : yield* threadOf(parent);
  const linked = comment.parentId !== parentId || comment.threadId !== threadId;
  const votes = yield* convertVotes(comment._id);
  const likeCount = likeCountOf(comment) + votes.likesAdded;
  if (linked || votes.likesAdded > 0 || comment.likeCount === undefined) {
    yield* writer
      .table("comments")
      .replace(comment._id, {
        ...Struct.omit(comment, [
          "_id",
          "_creationTime",
          "parentId",
          "threadId",
        ]),
        ...(parentId === undefined ? {} : { parentId }),
        ...(threadId === undefined ? {} : { threadId }),
        likeCount,
      })
      .pipe(Effect.orDie);
  }
  return {
    ...NO_COUNTS,
    likesAdded: votes.likesAdded,
    linked: linked ? 1 : 0,
    orphaned: orphaned ? 1 : 0,
    votesRemoved: votes.votesRemoved,
  };
});

/**
 * Sets the reply count of a top-level comment to the size of its thread. The thread
 * is read in this one transaction, so the count is a snapshot: Convex retries the
 * transaction when a reply lands in the thread while it runs, and a reply that
 * commits after it is counted by the comment trigger.
 */
const recountThread = Effect.fn("comments.migration.recountThread")(function* (
  comment: CommentDoc
) {
  const reader = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const replies = yield* reader
    .table("comments")
    .index("by_threadId", (q) => q.eq("threadId", comment._id))
    .collect()
    .pipe(Effect.orDie);
  if (replies.length === comment.replyCount) {
    return NO_COUNTS;
  }
  yield* writer
    .table("comments")
    .replace(comment._id, {
      ...Struct.omit(comment, ["_id", "_creationTime"]),
      replyCount: replies.length,
    })
    .pipe(Effect.orDie);
  return { ...NO_COUNTS, recounted: 1 };
});

/** Links every comment of a page in order, so each parent is linked before its replies. */
const relinkPage = Effect.fn("comments.migration.relinkPage")(function* (
  page: readonly CommentDoc[]
) {
  const counts = yield* Effect.forEach(page, relinkComment);
  return Arr.reduce(counts, NO_COUNTS, plus);
});

/** Recounts the threads of the top-level comments of a page. */
const recountPage = Effect.fn("comments.migration.recountPage")(function* (
  page: readonly CommentDoc[]
) {
  const counts = yield* Effect.forEach(
    Arr.filter(page, (comment) => comment.parentId === undefined),
    recountThread
  );
  return Arr.reduce(counts, NO_COUNTS, plus);
});

/**
 * Runs one page of the migration (`migration.spec.ts`), and schedules the next page
 * while the table has more.
 */
const run = FunctionImpl.make(
  databaseSchema,
  spec,
  "run",
  Effect.fn("comments.migration.run")(function* (args) {
    const reader = yield* DatabaseReader;
    const scheduler = yield* Scheduler;
    const recount = args.recount === true;
    const page = yield* reader
      .table("comments")
      .index("by_creation_time")
      .paginate({ cursor: args.cursor ?? null, numItems: MIGRATION_PAGE })
      .pipe(Effect.orDie);
    const counts = yield* recount
      ? recountPage(page.page)
      : relinkPage(page.page);
    if (!page.isDone) {
      yield* scheduler.runAfter(
        Duration.millis(0),
        refs.internal.comments.migration.run,
        {
          cursor: page.continueCursor,
          ...(recount ? { recount } : {}),
        }
      );
    }
    const result = {
      ...counts,
      done: page.isDone,
      scanned: page.page.length,
    };
    yield* Effect.logInfo("Comments migration page", { ...result, recount });
    return result;
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(run),
  Layer.provide(atomic),
  GroupImpl.finalize
);
