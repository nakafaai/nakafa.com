import { FunctionImpl, GroupImpl } from "@confect/server";
import api from "@repo/backend/confect/_generated/api";
import {
  addComment,
  deleteComment,
  getCommentsBySlug,
  getCommentsByUserId,
  voteOnComment,
} from "@repo/backend/confect/modules/content/comments.service";
import { Effect, Layer } from "effect";

const comments_mutations_addCommentImpl = FunctionImpl.make(
  api,
  "comments.mutations",
  "addComment",
  (args) =>
    addComment(args).pipe(
      Effect.catchTags({
        CommentActionError: (error) => Effect.die(error),
        UnauthorizedUser: (error) => Effect.die(error),
      }),
      Effect.orDie
    )
);
const comments_mutations_deleteCommentImpl = FunctionImpl.make(
  api,
  "comments.mutations",
  "deleteComment",
  (args) =>
    deleteComment(args).pipe(
      Effect.catchTags({
        CommentActionError: (error) => Effect.die(error),
        UnauthorizedUser: (error) => Effect.die(error),
      }),
      Effect.orDie
    )
);
const comments_mutations_voteOnCommentImpl = FunctionImpl.make(
  api,
  "comments.mutations",
  "voteOnComment",
  (args) =>
    voteOnComment(args).pipe(
      Effect.catchTags({
        CommentActionError: (error) => Effect.die(error),
        UnauthorizedUser: (error) => Effect.die(error),
      }),
      Effect.orDie
    )
);
const comments_queries_getCommentsBySlugImpl = FunctionImpl.make(
  api,
  "comments.queries",
  "getCommentsBySlug",
  (args) => getCommentsBySlug(args).pipe(Effect.orDie)
);
const comments_queries_getCommentsByUserIdImpl = FunctionImpl.make(
  api,
  "comments.queries",
  "getCommentsByUserId",
  (args) => getCommentsByUserId(args).pipe(Effect.orDie)
);
const commentsMutationsImpl = GroupImpl.make(api, "comments.mutations")
  .pipe(Layer.provide(comments_mutations_addCommentImpl))
  .pipe(Layer.provide(comments_mutations_deleteCommentImpl))
  .pipe(Layer.provide(comments_mutations_voteOnCommentImpl));
const commentsQueriesImpl = GroupImpl.make(api, "comments.queries")
  .pipe(Layer.provide(comments_queries_getCommentsBySlugImpl))
  .pipe(Layer.provide(comments_queries_getCommentsByUserIdImpl));
const commentsImpl = GroupImpl.make(api, "comments")
  .pipe(Layer.provide(commentsMutationsImpl))
  .pipe(Layer.provide(commentsQueriesImpl));
export const commentsLayer = Layer.mergeAll(commentsImpl);
