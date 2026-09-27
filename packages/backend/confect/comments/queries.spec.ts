import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import commentsTable from "@repo/backend/confect/_generated/tables/comments";
import { AuthFailure } from "@repo/backend/confect/auth/spec";
import { commentVoteValidator } from "@repo/backend/confect/comments/schema";
import { userDataValidator } from "@repo/backend/confect/lib/validators/user";
import Session from "@repo/backend/confect/middleware/session.spec";
import { Schema } from "effect";
export const publicCommentUserValidator = Schema.Struct({
  _id: userDataValidator.fields._id,
  image: userDataValidator.fields.image,
  name: userDataValidator.fields.name,
});
export const commentWithViewerVoteValidator = Schema.Struct({
  ...commentsTable.Doc.fields,
  viewerVote: Schema.NullOr(commentVoteValidator),
});
export const commentWithUserValidator = Schema.Struct({
  ...commentWithViewerVoteValidator.fields,
  user: Schema.NullOr(publicCommentUserValidator),
  replyToUser: Schema.NullOr(publicCommentUserValidator),
});

/** Load the current viewer's vote for each bounded comment page row. */
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.publicPaginatedQuery({
      name: "getCommentsBySlug",
      args: () => ({
        slug: Schema.String,
      }),
      item: () => commentWithUserValidator,
      error: () => AuthFailure,
    }).middleware(Session)
  )
  .addFunction(
    FunctionSpec.publicPaginatedQuery({
      name: "getCommentsByUserId",
      args: () => ({
        userId: IdSchema("users"),
      }),
      item: () => commentWithViewerVoteValidator,
      error: () => AuthFailure,
    }).middleware(Session)
  );
