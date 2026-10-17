import { FunctionImpl, GroupImpl } from "@confect/server";
import refs from "@repo/backend/confect/_generated/refs";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { Scheduler } from "@repo/backend/confect/_generated/services";
import { POST_LIKE_CLEANUP_BATCH_SIZE } from "@repo/backend/confect/posts/cleanup";
import spec from "@repo/backend/confect/posts/cleanup.spec";
import { removePostLikeBatch } from "@repo/backend/confect/posts/likes";
import { Duration, Effect, Layer } from "effect";

const cleanupDeletedPost = FunctionImpl.make(
  databaseSchema,
  spec,
  "cleanupDeletedPost",
  Effect.fn("posts.cleanup.cleanupDeletedPost")(function* (args) {
    const scheduler = yield* Scheduler;
    const removed = yield* removePostLikeBatch(args.postId);
    if (removed < POST_LIKE_CLEANUP_BATCH_SIZE) {
      return null;
    }
    yield* scheduler.runAfter(
      Duration.zero,
      refs.internal.posts.cleanup.cleanupDeletedPost,
      args
    );
    return null;
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(cleanupDeletedPost),
  GroupImpl.finalize
);
