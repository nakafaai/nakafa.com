import { FunctionImpl, GroupImpl } from "@confect/server";
import type { Id } from "@repo/backend/confect/_generated/id";
import refs from "@repo/backend/confect/_generated/refs";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseWriter,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import { requireAuth } from "@repo/backend/confect/auth/session";
import sessionMiddleware from "@repo/backend/confect/middleware/session.impl";
import { removeLike } from "@repo/backend/confect/posts/likes";
import spec, {
  PostWriteError,
} from "@repo/backend/confect/posts/mutations.spec";
import { findLike, findPost } from "@repo/backend/confect/posts/rows";
import {
  POST_TEXT_MAX_LENGTH,
  readPostText,
} from "@repo/backend/confect/posts/schema";
import { Duration, Effect, Layer, Result, Struct } from "effect";

/** The post with this id. A missing post gives the same answer to every learner. */
const readPost = Effect.fn("posts.mutations.readPost")(function* (
  postId: Id<"posts">
) {
  const post = yield* findPost(postId);
  if (post === null) {
    return yield* new PostWriteError({
      code: "POST_NOT_FOUND",
      message: "Post not found.",
    });
  }
  return post;
});

const create = FunctionImpl.make(
  databaseSchema,
  spec,
  "create",
  Effect.fn("posts.mutations.create")(function* (args) {
    const writer = yield* DatabaseWriter;
    const user = yield* requireAuth();
    const text = readPostText(args.text);
    if (Result.isFailure(text)) {
      return yield* new PostWriteError({
        code: text.failure,
        message: `The post must hold 1 to ${POST_TEXT_MAX_LENGTH} characters.`,
      });
    }
    return yield* writer
      .table("posts")
      .insert({
        authorId: user.appUser._id,
        text: text.success,
        likeCount: 0,
      })
      .pipe(Effect.orDie);
  })
);

const remove = FunctionImpl.make(
  databaseSchema,
  spec,
  "remove",
  Effect.fn("posts.mutations.remove")(function* (args) {
    const writer = yield* DatabaseWriter;
    const scheduler = yield* Scheduler;
    const user = yield* requireAuth();
    const post = yield* findPost(args.postId);
    // Only the author deletes a post. Another learner gets the answer for a
    // missing post, so the same answer covers a post that is not theirs.
    if (post === null || post.authorId !== user.appUser._id) {
      return yield* new PostWriteError({
        code: "POST_NOT_FOUND",
        message: "Post not found.",
      });
    }
    yield* writer.table("posts").delete(post._id);
    // The likes go in bounded batches, so a post with many likes takes several passes.
    yield* scheduler.runAfter(
      Duration.zero,
      refs.internal.posts.cleanup.cleanupDeletedPost,
      { postId: post._id }
    );
    return null;
  })
);

const like = FunctionImpl.make(
  databaseSchema,
  spec,
  "like",
  Effect.fn("posts.mutations.like")(function* (args) {
    const writer = yield* DatabaseWriter;
    const user = yield* requireAuth();
    const post = yield* readPost(args.postId);
    const existing = yield* findLike(post._id, user.appUser._id);
    if (existing !== null) {
      return null;
    }
    yield* writer
      .table("postLikes")
      .insert({ postId: post._id, userId: user.appUser._id })
      .pipe(Effect.orDie);
    yield* writer
      .table("posts")
      .replace(post._id, {
        ...Struct.omit(post, ["_id", "_creationTime"]),
        likeCount: post.likeCount + 1,
      })
      .pipe(Effect.orDie);
    return null;
  })
);

const unlike = FunctionImpl.make(
  databaseSchema,
  spec,
  "unlike",
  Effect.fn("posts.mutations.unlike")(function* (args) {
    const user = yield* requireAuth();
    const post = yield* readPost(args.postId);
    const existing = yield* findLike(post._id, user.appUser._id);
    if (existing === null) {
      return null;
    }
    yield* removeLike(existing, post);
    return null;
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(create),
  Layer.provide(remove),
  Layer.provide(like),
  Layer.provide(unlike),
  Layer.provide(sessionMiddleware),
  GroupImpl.finalize
);
