import {
  DatabaseReader,
  DatabaseWriter,
  MutationCtx as MutationCtxService,
} from "@repo/backend/confect/_generated/services";
import {
  forumPostsByAuthorSequence,
  forumPostsBySequence,
} from "@repo/backend/confect/classes/forums/aggregate";
import { updateForumReadState } from "@repo/backend/confect/classes/forums/readState";
import type { DataModel } from "@repo/backend/convex/_generated/dataModel";
import type { Change } from "convex-helpers/server/triggers";
import { Clock, Effect, Option } from "effect";

/** Keep the aggregate component synchronized in the post's transaction. */
const syncForumPostAggregates = Effect.fn(
  "triggers.forums.posts.syncForumPostAggregates"
)(function* (change: Change<DataModel, "schoolClassForumPosts">) {
  const ctx = yield* MutationCtxService;
  if (change.operation === "insert") {
    yield* Effect.promise(() =>
      forumPostsBySequence.insert(ctx, change.newDoc)
    );
    yield* Effect.promise(() =>
      forumPostsByAuthorSequence.insert(ctx, change.newDoc)
    );
    return;
  }
  if (change.operation === "update") {
    yield* Effect.promise(() =>
      forumPostsBySequence.replace(ctx, change.oldDoc, change.newDoc)
    );
    yield* Effect.promise(() =>
      forumPostsByAuthorSequence.replace(ctx, change.oldDoc, change.newDoc)
    );
    return;
  }
  yield* Effect.promise(() => forumPostsBySequence.delete(ctx, change.oldDoc));
  yield* Effect.promise(() =>
    forumPostsByAuthorSequence.delete(ctx, change.oldDoc)
  );
});

/** Update forum counters, reply counts, and the author's read boundary atomically. */
export const forumPostsHandler = Effect.fn(
  "triggers.forums.posts.forumPostsHandler"
)(function* (change: Change<DataModel, "schoolClassForumPosts">) {
  yield* syncForumPostAggregates(change);
  if (change.operation === "update") {
    return;
  }
  const reader = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const post = change.operation === "insert" ? change.newDoc : change.oldDoc;
  const forum = yield* reader
    .table("schoolClassForums")
    .get(post.forumId)
    .pipe(
      Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
      Effect.orDie
    );
  if (forum) {
    if (change.operation === "insert") {
      yield* writer
        .table("schoolClassForums")
        .patch(post.forumId, {
          postCount: forum.postCount + 1,
          lastPostAt: post._creationTime,
          lastPostBy: post.createdBy,
          updatedAt: yield* Clock.currentTimeMillis,
        })
        .pipe(Effect.orDie);
      yield* updateForumReadState({
        forumId: post.forumId,
        classId: post.classId,
        userId: post.createdBy,
        lastReadSequence: post.sequence,
      });
    } else {
      const latest = yield* reader
        .table("schoolClassForumPosts")
        .index(
          "by_forumId_and_sequence",
          (q) => q.eq("forumId", post.forumId),
          "desc"
        )
        .first()
        .pipe(Effect.map(Option.getOrNull), Effect.orDie);
      yield* writer
        .table("schoolClassForums")
        .patch(post.forumId, {
          postCount: Math.max(forum.postCount - 1, 0),
          lastPostAt: latest?._creationTime ?? forum._creationTime,
          lastPostBy: latest?.createdBy ?? forum.createdBy,
          updatedAt: yield* Clock.currentTimeMillis,
        })
        .pipe(Effect.orDie);
    }
  }
  if (!post.parentId) {
    return;
  }
  const parent = yield* reader
    .table("schoolClassForumPosts")
    .get(post.parentId)
    .pipe(Effect.orDie);
  yield* writer
    .table("schoolClassForumPosts")
    .patch(post.parentId, {
      replyCount:
        change.operation === "insert"
          ? parent.replyCount + 1
          : Math.max(parent.replyCount - 1, 0),
      updatedAt: yield* Clock.currentTimeMillis,
    })
    .pipe(Effect.orDie);
});
