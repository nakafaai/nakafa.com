import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Effect } from "effect";

/** The post with this id, or null once it is deleted. */
export const findPost = Effect.fn("posts.rows.findPost")(function* (
  postId: Id<"posts">
) {
  const database = yield* DatabaseReader;
  return yield* database
    .table("posts")
    .get(postId)
    .pipe(
      Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
      Effect.orDie
    );
});

/** The like a learner left on a post, or null when they have not liked it. */
export const findLike = Effect.fn("posts.rows.findLike")(function* (
  postId: Id<"posts">,
  userId: Id<"users">
) {
  const database = yield* DatabaseReader;
  return yield* database
    .table("postLikes")
    .get("by_postId_and_userId", postId, userId)
    .pipe(
      Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
      Effect.orDie
    );
});
