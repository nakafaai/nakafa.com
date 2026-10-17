import { FunctionImpl, GroupImpl } from "@confect/server";
import refs from "@repo/backend/confect/_generated/refs";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import { POST_LIKE_CLEANUP_BATCH_SIZE } from "@repo/backend/confect/posts/cleanup";
import spec from "@repo/backend/confect/posts/cleanup.spec";
import { Duration, Effect, Layer } from "effect";

const cleanupDeletedPost = FunctionImpl.make(
  databaseSchema,
  spec,
  "cleanupDeletedPost",
  Effect.fn("posts.cleanup.cleanupDeletedPost")(function* (args) {
    const scheduler = yield* Scheduler;
    const reader = yield* DatabaseReader;
    const writer = yield* DatabaseWriter;
    const likes = yield* reader
      .table("postLikes")
      .index("by_postId_and_userId", (q) => q.eq("postId", args.postId))
      .take(POST_LIKE_CLEANUP_BATCH_SIZE)
      .pipe(Effect.orDie);
    for (const like of likes) {
      yield* writer.table("postLikes").delete(like._id);
    }
    if (likes.length < POST_LIKE_CLEANUP_BATCH_SIZE) {
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
