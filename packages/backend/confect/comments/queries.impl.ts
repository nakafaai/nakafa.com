import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { getOptionalAppUserForRead } from "@repo/backend/confect/auth/session";
import { getViewerVotes } from "@repo/backend/confect/comments/queries";
import spec from "@repo/backend/confect/comments/queries.spec";
import sessionMiddleware from "@repo/backend/confect/middleware/session.impl";
import { getUserMap } from "@repo/backend/confect/users/directory";
import { cleanSlug } from "@repo/utilities/helper";
import { Array as Arr, Effect, HashMap, Layer, Option, Struct } from "effect";

const getCommentsBySlug = FunctionImpl.make(
  databaseSchema,
  spec,
  "getCommentsBySlug",
  Effect.fn("comments.queries.getCommentsBySlug")(function* (args) {
    const database = yield* DatabaseReader;
    const comments = yield* database
      .table("comments")
      .index("by_slug", (q) => q.eq("slug", cleanSlug(args.slug)), "desc")
      .paginate(args.paginationOpts)
      .pipe(Effect.orDie);
    const commentUserIds = Arr.map(comments.page, (comment) => comment.userId);
    const replyToUserIds = Arr.flatMap(comments.page, (comment) =>
      comment.replyToUserId ? [comment.replyToUserId] : []
    );
    const viewer = yield* getOptionalAppUserForRead();
    const [userMap, replyToUserMap, viewerVotes] = yield* Effect.all([
      getUserMap(commentUserIds),
      getUserMap(replyToUserIds),
      getViewerVotes(comments.page, viewer?.appUser._id ?? null),
    ]);
    return {
      ...comments,
      page: Arr.map(comments.page, (comment) => {
        const user = Option.getOrUndefined(
          HashMap.get(userMap, comment.userId)
        );
        const replyToUser = comment.replyToUserId
          ? Option.getOrUndefined(
              HashMap.get(replyToUserMap, comment.replyToUserId)
            )
          : undefined;
        return {
          ...comment,
          viewerVote: Option.getOrNull(HashMap.get(viewerVotes, comment._id)),
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
    const database = yield* DatabaseReader;
    const comments = yield* database
      .table("comments")
      .index("by_userId", (q) => q.eq("userId", args.userId), "desc")
      .paginate(args.paginationOpts)
      .pipe(Effect.orDie);
    const viewer = yield* getOptionalAppUserForRead();
    const viewerVotes = yield* getViewerVotes(
      comments.page,
      viewer?.appUser._id ?? null
    );
    return {
      ...comments,
      page: Arr.map(comments.page, (comment) => ({
        ...comment,
        viewerVote: Option.getOrNull(HashMap.get(viewerVotes, comment._id)),
      })),
    };
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(getCommentsBySlug),
  Layer.provide(getCommentsByUserId),
  Layer.provide(sessionMiddleware),
  GroupImpl.finalize
);
