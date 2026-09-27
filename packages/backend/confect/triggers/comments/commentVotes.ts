import { DatabaseReader, DatabaseWriter } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import type { DataModel } from "@repo/backend/convex/_generated/dataModel";
import type { GenericMutationCtx } from "convex/server";
import type { Change } from "convex-helpers/server/triggers";
import { Effect } from "effect";

/** Applies insert/delete deltas to the matching denormalized vote counter. */
export const commentVotesHandler = Effect.fn(
  "triggers.comments.updateVoteCount"
)(function* (
  ctx: GenericMutationCtx<DataModel>,
  change: Change<DataModel, "commentVotes">
) {
  const database = DatabaseReader.make(databaseSchema, ctx.db);
  const writer = DatabaseWriter.make(databaseSchema, ctx.db);
  if (change.operation === "update") {
    return;
  }
  const vote = change.operation === "insert" ? change.newDoc : change.oldDoc;
  const comment = yield* database
    .table("comments")
    .get(vote.commentId)
    .pipe(Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)));
  if (!comment) {
    return;
  }
  const counter = vote.vote === 1 ? "upvoteCount" : "downvoteCount";
  const count =
    change.operation === "insert"
      ? comment[counter] + 1
      : Math.max(comment[counter] - 1, 0);
  yield* writer.table("comments").patch(vote.commentId, {
    [counter]: count,
  });
}, Effect.orDie);
