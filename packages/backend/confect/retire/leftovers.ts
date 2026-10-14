import { TableAggregate } from "@convex-dev/aggregate";
import { MutationCtx } from "@repo/backend/confect/_generated/services";
import { components } from "@repo/backend/convex/_generated/api";
import type {
  DataModel,
  Doc,
  Id,
} from "@repo/backend/convex/_generated/dataModel";
import { Effect } from "effect";

/**
 * The aggregate of forum posts by forum that the old post trigger kept. A post
 * leaves it here, with the same namespace and key it had when it went in.
 */
const forumPostsBySequence = new TableAggregate<{
  Namespace: Id<"schoolClassForums">;
  Key: number;
  DataModel: DataModel;
  TableName: "schoolClassForumPosts";
}>(components.forumPostsBySequence, {
  namespace: (post) => post.forumId,
  sortKey: (post) => post.sequence,
});

/** The aggregate of forum posts by forum and author that the old trigger kept. */
const forumPostsByAuthorSequence = new TableAggregate<{
  Namespace: [Id<"schoolClassForums">, Id<"users">];
  Key: number;
  DataModel: DataModel;
  TableName: "schoolClassForumPosts";
}>(components.forumPostsByAuthorSequence, {
  namespace: (post) => [post.forumId, post.createdBy],
  sortKey: (post) => post.sequence,
});

/**
 * The functions below remove what a row owned outside its table and say how
 * many stored files and scheduled jobs that was. With `dry` set they only
 * count. This is the answer for a row that owned nothing.
 */
export const nothing = Effect.succeed({ files: 0, jobs: 0 });

/**
 * Deletes one stored file unless the row names none or it is gone already, and
 * counts it when it was there.
 */
export const dropFile = Effect.fn("retire.school.dropFile")(function* (
  storageId: Id<"_storage"> | undefined,
  dry: boolean
) {
  if (storageId === undefined) {
    return yield* nothing;
  }
  const ctx = yield* MutationCtx;
  const file = yield* Effect.promise(() => ctx.db.system.get(storageId));
  if (file === null) {
    return yield* nothing;
  }
  if (!dry) {
    yield* Effect.promise(() => ctx.storage.delete(storageId));
  }
  return { files: 1, jobs: 0 };
});

/** Cancels a scheduled job that has not started, and counts it when it did. */
export const dropJob = Effect.fn("retire.school.dropJob")(function* (
  jobId: Id<"_scheduled_functions"> | undefined,
  dry: boolean
) {
  if (jobId === undefined) {
    return yield* nothing;
  }
  const ctx = yield* MutationCtx;
  const job = yield* Effect.promise(() => ctx.db.system.get(jobId));
  if (job?.state.kind !== "pending") {
    return yield* nothing;
  }
  if (!dry) {
    yield* Effect.promise(() => ctx.scheduler.cancel(jobId));
  }
  return { files: 0, jobs: 1 };
});

/**
 * Takes one forum post out of both forum aggregates, which may never have held
 * it. A dry call leaves them as they are.
 */
export const dropFromAggregates = Effect.fn("retire.school.dropFromAggregates")(
  function* (post: Doc<"schoolClassForumPosts">, dry: boolean) {
    if (dry) {
      return yield* nothing;
    }
    const ctx = yield* MutationCtx;
    yield* Effect.promise(() => forumPostsBySequence.deleteIfExists(ctx, post));
    yield* Effect.promise(() =>
      forumPostsByAuthorSequence.deleteIfExists(ctx, post)
    );
    return yield* nothing;
  }
);
