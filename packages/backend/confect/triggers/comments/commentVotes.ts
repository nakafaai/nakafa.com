import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import type { DataModel } from "@repo/backend/convex/_generated/dataModel";
import type { Change } from "convex-helpers/server/triggers";
import { Effect } from "effect";

/** Applies insert/delete deltas to the matching denormalized vote counter. */
export const commentVotesHandler = Effect.fn(
  "triggers.comments.updateVoteCount"
)(function* (change: Change<DataModel, "commentVotes">) {
  const database = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
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
