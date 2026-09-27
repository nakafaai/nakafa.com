import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Effect } from "effect";

/**
 * Move a user's forum read boundary forward when the next boundary is newer.
 */
export const updateForumReadState = Effect.fn(
  "classes.forums.readState.updateForumReadState"
)(function* (args: {
  forumId: Id<"schoolClassForums">;
  classId: Id<"schoolClasses">;
  userId: Id<"users">;
  lastReadSequence: number;
}) {
  const existing = yield* (yield* DatabaseReader)
    .table("schoolClassForumReadStates")
    .get("by_forumId_and_userId", args.forumId, args.userId)
    .pipe(Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)));
  if (!existing) {
    yield* (yield* DatabaseWriter).table("schoolClassForumReadStates").insert({
      classId: args.classId,
      forumId: args.forumId,
      lastReadSequence: args.lastReadSequence,
      userId: args.userId,
    });
    return;
  }
  if (args.lastReadSequence <= existing.lastReadSequence) {
    return;
  }
  yield* (yield* DatabaseWriter)
    .table("schoolClassForumReadStates")
    .patch(existing._id, {
      lastReadSequence: args.lastReadSequence,
    });
}, Effect.orDie);
