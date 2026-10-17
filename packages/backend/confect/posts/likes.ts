import type { Id } from "@repo/backend/confect/_generated/id";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import type postLikesTable from "@repo/backend/confect/_generated/tables/postLikes";
import type postsTable from "@repo/backend/confect/_generated/tables/posts";
import { POST_LIKE_CLEANUP_BATCH_SIZE } from "@repo/backend/confect/posts/cleanup";
import { Effect, Struct } from "effect";

/** A post as the database holds it. */
type PostDoc = typeof postsTable.Doc.Type;

/** A like as the database holds it. */
type LikeDoc = typeof postLikesTable.Doc.Type;

/**
 * Removes one like and takes it off the count of its post, which the caller
 * has read. A post that is gone takes only its like, so no count is written
 * for it.
 */
export const removeLike = Effect.fn("posts.likes.removeLike")(function* (
  like: LikeDoc,
  post: PostDoc | null
) {
  const writer = yield* DatabaseWriter;
  yield* writer.table("postLikes").delete(like._id);
  if (post === null) {
    return;
  }
  yield* writer
    .table("posts")
    .replace(post._id, {
      ...Struct.omit(post, ["_id", "_creationTime"]),
      likeCount: post.likeCount - 1,
    })
    .pipe(Effect.orDie);
});

/**
 * Removes one bounded batch of the likes of a post, and returns how many it
 * removed. A post with more likes than one batch takes several passes.
 */
export const removePostLikeBatch = Effect.fn("posts.likes.removePostLikeBatch")(
  function* (postId: Id<"posts">) {
    const reader = yield* DatabaseReader;
    const writer = yield* DatabaseWriter;
    const likes = yield* reader
      .table("postLikes")
      .index("by_postId_and_userId", (q) => q.eq("postId", postId))
      .take(POST_LIKE_CLEANUP_BATCH_SIZE)
      .pipe(Effect.orDie);
    for (const like of likes) {
      yield* writer.table("postLikes").delete(like._id);
    }
    return likes.length;
  }
);
