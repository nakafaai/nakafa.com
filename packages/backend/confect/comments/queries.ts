import type { Docs } from "@repo/backend/confect/_generated/docs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Array as Arr, Effect } from "effect";
/** Load the current viewer's vote for each bounded comment page row. */
export const getViewerVotes = Effect.fn("comments.queries.getViewerVotes")(
  function* (comments: Docs["comments"][], userId: Id<"users"> | null) {
    const _reader = yield* DatabaseReader;
    if (!userId) {
      return new Map<Id<"comments">, -1 | 1>();
    }
    const votes = yield* Effect.forEach(comments, (comment) =>
      _reader
        .table("commentVotes")
        .get("by_commentId_and_userId", comment._id, userId)
        .pipe(
          Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
          Effect.orDie
        )
    );
    return new Map(
      Arr.flatMap(comments, (comment, index) => {
        const vote = votes[index];
        return vote ? [[comment._id, vote.vote] as const] : [];
      })
    );
  }
);
