import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
  MutationCtx as MutationCtxService,
} from "@repo/backend/confect/_generated/services";
import { requireAuth } from "@repo/backend/confect/auth/session";
import { loadActiveForumWithAccess } from "@repo/backend/confect/classes/forums/access";
import { MAX_FORUM_REACTION_VARIANTS } from "@repo/backend/confect/classes/forums/constants";
import spec from "@repo/backend/confect/classes/forums/mutations/reactions.spec";
import { validateForumReactionValue } from "@repo/backend/confect/classes/forums/reactions";
import { ForumError } from "@repo/backend/confect/classes/forums/spec";
import atomic from "@repo/backend/confect/middleware/atomic.impl";
import { Effect, Layer } from "effect";

/**
 * Toggle one reaction on a forum post.
 */
const togglePostReaction = FunctionImpl.make(
  databaseSchema,
  spec,
  "togglePostReaction",
  Effect.fn("classes.forums.mutations.reactions.togglePostReaction")(
    function* (args) {
      const writer = yield* DatabaseWriter;
      const database = yield* DatabaseReader;
      const ctx = yield* MutationCtxService;
      const emoji = yield* validateForumReactionValue(args.emoji);
      const user = yield* requireAuth(ctx);
      const userId = user.appUser._id;
      const post = yield* database
        .table("schoolClassForumPosts")
        .get(args.postId)
        .pipe(
          Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
          Effect.orDie
        );
      if (!post) {
        return yield* new ForumError({
          code: "POST_NOT_FOUND",
          message: "Post not found.",
        });
      }
      yield* loadActiveForumWithAccess(ctx, post.forumId, userId);
      const existingReaction = yield* database
        .table("schoolClassForumPostReactions")
        .get("by_postId_and_userId_and_emoji", args.postId, userId, emoji)
        .pipe(
          Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
          Effect.orDie
        );
      if (existingReaction) {
        yield* writer
          .table("schoolClassForumPostReactions")
          .delete(existingReaction._id);
        return {
          added: false,
        };
      }
      const hasReactionVariant = post.reactionCounts.some(
        (reactionCount) => reactionCount.emoji === emoji
      );
      if (
        !hasReactionVariant &&
        post.reactionCounts.length >= MAX_FORUM_REACTION_VARIANTS
      ) {
        return yield* new ForumError({
          code: "FORUM_REACTION_VARIANT_LIMIT_EXCEEDED",
          message: "Forum post reaction variants exceed the supported limit.",
        });
      }
      yield* writer
        .table("schoolClassForumPostReactions")
        .insert({
          emoji,
          postId: args.postId,
          userId,
        })
        .pipe(Effect.orDie);
      return {
        added: true,
      };
    }
  )
);
const toggleForumReaction = FunctionImpl.make(
  databaseSchema,
  spec,
  "toggleForumReaction",
  Effect.fn("classes.forums.mutations.reactions.toggleForumReaction")(
    function* (args) {
      const writer = yield* DatabaseWriter;
      const database = yield* DatabaseReader;
      const ctx = yield* MutationCtxService;
      const emoji = yield* validateForumReactionValue(args.emoji);
      const user = yield* requireAuth(ctx);
      const userId = user.appUser._id;
      const { forum } = yield* loadActiveForumWithAccess(
        ctx,
        args.forumId,
        userId
      );
      const existingReaction = yield* database
        .table("schoolClassForumReactions")
        .get("by_forumId_and_userId_and_emoji", args.forumId, userId, emoji)
        .pipe(
          Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
          Effect.orDie
        );
      if (existingReaction) {
        yield* writer
          .table("schoolClassForumReactions")
          .delete(existingReaction._id);
        return {
          added: false,
        };
      }
      const hasReactionVariant = forum.reactionCounts.some(
        (reactionCount) => reactionCount.emoji === emoji
      );
      if (
        !hasReactionVariant &&
        forum.reactionCounts.length >= MAX_FORUM_REACTION_VARIANTS
      ) {
        return yield* new ForumError({
          code: "FORUM_REACTION_VARIANT_LIMIT_EXCEEDED",
          message: "Forum reaction variants exceed the supported limit.",
        });
      }
      yield* writer
        .table("schoolClassForumReactions")
        .insert({
          emoji,
          forumId: args.forumId,
          userId,
        })
        .pipe(Effect.orDie);
      return {
        added: true,
      };
    }
  )
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(togglePostReaction),
  Layer.provide(toggleForumReaction),
  Layer.provide(atomic),
  GroupImpl.finalize
);
