import { DatabaseReader, FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { QueryCtx as QueryCtxService } from "@repo/backend/confect/_generated/services";
import { getOptionalAppUserForRead } from "@repo/backend/confect/auth/session";
import { getViewerVotes } from "@repo/backend/confect/comments/queries";
import spec from "@repo/backend/confect/comments/queries.spec";
import { getUserMap } from "@repo/backend/confect/users/directory";
import { cleanSlug } from "@repo/utilities/helper";
import { Effect, Layer, Struct } from "effect";

const getCommentsBySlug = FunctionImpl.make(
  databaseSchema,
  spec,
  "getCommentsBySlug",
  Effect.fn("comments.queries.getCommentsBySlug")(function* (args) {
    const ctx = yield* QueryCtxService;
    const database = DatabaseReader.make(databaseSchema, ctx.db);
    const comments = yield* database
      .table("comments")
      .index("by_slug", (q) => q.eq("slug", cleanSlug(args.slug)), "desc")
      .paginate(args.paginationOpts)
      .pipe(Effect.orDie);
    const commentUserIds = comments.page.map((comment) => comment.userId);
    const replyToUserIds = comments.page.flatMap((comment) =>
      comment.replyToUserId ? [comment.replyToUserId] : []
    );
    const viewer = yield* getOptionalAppUserForRead(ctx);
    const [userMap, replyToUserMap, viewerVotes] = yield* Effect.all([
      getUserMap(ctx, commentUserIds),
      getUserMap(ctx, replyToUserIds),
      getViewerVotes(ctx, comments.page, viewer?.appUser._id ?? null),
    ]);
    return {
      ...comments,
      page: comments.page.map((comment) => {
        const user = userMap.get(comment.userId);
        const replyToUser = comment.replyToUserId
          ? replyToUserMap.get(comment.replyToUserId)
          : undefined;
        return {
          ...comment,
          viewerVote: viewerVotes.get(comment._id) ?? null,
          user: user ? Struct.pick(user, ["_id", "image", "name"]) : null,
          replyToUser: replyToUser
            ? Struct.pick(replyToUser, ["_id", "image", "name"])
            : null,
        };
      }),
    };
  })
);
const getCommentsByUserId = FunctionImpl.make(
  databaseSchema,
  spec,
  "getCommentsByUserId",
  Effect.fn("comments.queries.getCommentsByUserId")(function* (args) {
    const ctx = yield* QueryCtxService;
    const database = DatabaseReader.make(databaseSchema, ctx.db);
    const comments = yield* database
      .table("comments")
      .index("by_userId", (q) => q.eq("userId", args.userId), "desc")
      .paginate(args.paginationOpts)
      .pipe(Effect.orDie);
    const viewer = yield* getOptionalAppUserForRead(ctx);
    const viewerVotes = yield* getViewerVotes(
      ctx,
      comments.page,
      viewer?.appUser._id ?? null
    );
    return {
      ...comments,
      page: comments.page.map((comment) => ({
        ...comment,
        viewerVote: viewerVotes.get(comment._id) ?? null,
      })),
    };
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(getCommentsBySlug),
  Layer.provide(getCommentsByUserId),
  GroupImpl.finalize
);
