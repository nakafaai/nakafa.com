import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  MutationCtx as MutationCtxService,
} from "@repo/backend/confect/_generated/services";
import { requireAuth } from "@repo/backend/confect/auth/session";
import { loadActiveForumWithAccess } from "@repo/backend/confect/classes/forums/access";
import spec from "@repo/backend/confect/classes/forums/mutations/readState.spec";
import { updateForumReadState } from "@repo/backend/confect/classes/forums/readState";
import { ForumError } from "@repo/backend/confect/classes/forums/spec";
import atomic from "@repo/backend/confect/middleware/atomic.impl";
import { Effect, Layer } from "effect";

/**
 * Mark a forum as read through a concrete post boundary.
 */
const markForumRead = FunctionImpl.make(
  databaseSchema,
  spec,
  "markForumRead",
  Effect.fn("classes.forums.mutations.readState.markForumRead")(
    function* (args) {
      const database = yield* DatabaseReader;
      const ctx = yield* MutationCtxService;
      const user = yield* requireAuth(ctx);
      const userId = user.appUser._id;
      const { forum } = yield* loadActiveForumWithAccess(
        ctx,
        args.forumId,
        userId
      );
      const lastReadPost = yield* database
        .table("schoolClassForumPosts")
        .get(args.lastReadPostId)
        .pipe(
          Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
          Effect.orDie
        );
      if (!lastReadPost || lastReadPost.forumId !== args.forumId) {
        return yield* new ForumError({
          code: "POST_NOT_FOUND",
          message: "Read boundary post not found.",
        });
      }
      yield* updateForumReadState(ctx, {
        classId: forum.classId,
        forumId: args.forumId,
        lastReadSequence: lastReadPost.sequence,
        userId,
      });
      return null;
    }
  )
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(markForumRead),
  Layer.provide(atomic),
  GroupImpl.finalize
);
