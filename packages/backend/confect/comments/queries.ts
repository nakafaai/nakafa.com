import { DatabaseReader } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { Effect } from "effect";
/** Load the current viewer's vote for each bounded comment page row. */
export const getViewerVotes = Effect.fn("comments.queries.getViewerVotes")(
  function* (
    ctx: QueryCtx,
    comments: Doc<"comments">[],
    userId: Id<"users"> | null
  ) {
    if (!userId) {
      return new Map<Id<"comments">, -1 | 1>();
    }
    const votes = yield* Effect.forEach(comments, (comment) =>
      DatabaseReader.make(databaseSchema, ctx.db)
        .table("commentVotes")
        .get("by_commentId_and_userId", comment._id, userId)
        .pipe(
          Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
          Effect.orDie
        )
    );
    return new Map(
      comments.flatMap((comment, index) => {
        const vote = votes[index];
        return vote ? [[comment._id, vote.vote] as const] : [];
      })
    );
  }
);
