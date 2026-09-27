import { DatabaseReader, DatabaseWriter } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { Effect } from "effect";

/**
 * Move a user's forum read boundary forward when the next boundary is newer.
 */
export const updateForumReadState = Effect.fn(
  "classes.forums.readState.updateForumReadState"
)(function* (
  ctx: Pick<MutationCtx, "db">,
  args: {
    forumId: Id<"schoolClassForums">;
    classId: Id<"schoolClasses">;
    userId: Id<"users">;
    lastReadSequence: number;
  }
) {
  const existing = yield* DatabaseReader.make(databaseSchema, ctx.db)
    .table("schoolClassForumReadStates")
    .get("by_forumId_and_userId", args.forumId, args.userId)
    .pipe(Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)));
  if (!existing) {
    yield* DatabaseWriter.make(databaseSchema, ctx.db)
      .table("schoolClassForumReadStates")
      .insert({
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
  yield* DatabaseWriter.make(databaseSchema, ctx.db)
    .table("schoolClassForumReadStates")
    .patch(existing._id, {
      lastReadSequence: args.lastReadSequence,
    });
}, Effect.orDie);
