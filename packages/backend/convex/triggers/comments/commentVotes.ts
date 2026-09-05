import type { DataModel } from "@repo/backend/convex/_generated/dataModel";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import type { GenericMutationCtx } from "convex/server";
import type { Change } from "convex-helpers/server/triggers";
import { Effect } from "effect";

/** Applies insert/delete deltas to the matching denormalized vote counter. */
const updateCommentVoteCount = Effect.fn("triggers.comments.updateVoteCount")(
  function* (
    ctx: GenericMutationCtx<DataModel>,
    change: Change<DataModel, "commentVotes">
  ) {
    if (change.operation === "update") {
      return;
    }
    const vote = change.operation === "insert" ? change.newDoc : change.oldDoc;
    const comment = yield* Effect.promise(() =>
      ctx.db.get("comments", vote.commentId)
    );
    if (!comment) {
      return;
    }
    const counter = vote.vote === 1 ? "upvoteCount" : "downvoteCount";
    const count =
      change.operation === "insert"
        ? comment[counter] + 1
        : Math.max(comment[counter] - 1, 0);
    yield* Effect.promise(() =>
      ctx.db.patch("comments", vote.commentId, { [counter]: count })
    );
  }
);

/** Runs the registered comment vote trigger at its native Convex boundary. */
export function commentVotesHandler(
  ctx: GenericMutationCtx<DataModel>,
  change: Change<DataModel, "commentVotes">
) {
  return runConvexProgram(updateCommentVoteCount(ctx, change));
}
