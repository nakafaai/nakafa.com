import { FunctionImpl, GroupImpl } from "@confect/server";
import api from "@repo/backend/confect/_generated/api";
import {
  addComment as contentComments_addComment,
  deleteComment as contentComments_deleteComment,
  getCommentsBySlug as contentComments_getCommentsBySlug,
  getCommentsByUserId as contentComments_getCommentsByUserId,
  voteOnComment as contentComments_voteOnComment,
} from "@repo/backend/confect/modules/content/comments.service";
import { Effect, Layer } from "effect";

const comments_mutations_addCommentImpl = FunctionImpl.make(
  api,
  "comments.mutations",
  "addComment",
  (args) =>
    contentComments_addComment(args).pipe(
      Effect.catchTags({
        CommentActionError: (error) => Effect.die(error),
        UnauthorizedUser: (error) => Effect.die(error),
      })
    )
);

const comments_mutations_deleteCommentImpl = FunctionImpl.make(
  api,
  "comments.mutations",
  "deleteComment",
  (args) =>
    contentComments_deleteComment(args).pipe(
      Effect.catchTags({
        CommentActionError: (error) => Effect.die(error),
        UnauthorizedUser: (error) => Effect.die(error),
      })
    )
);

const comments_mutations_voteOnCommentImpl = FunctionImpl.make(
  api,
  "comments.mutations",
  "voteOnComment",
  (args) =>
    contentComments_voteOnComment(args).pipe(
      Effect.catchTags({
        CommentActionError: (error) => Effect.die(error),
        UnauthorizedUser: (error) => Effect.die(error),
      })
    )
);

const comments_queries_getCommentsBySlugImpl = FunctionImpl.make(
  api,
  "comments.queries",
  "getCommentsBySlug",
  (args) => contentComments_getCommentsBySlug(args)
);

const comments_queries_getCommentsByUserIdImpl = FunctionImpl.make(
  api,
  "comments.queries",
  "getCommentsByUserId",
  (args) => contentComments_getCommentsByUserId(args)
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
