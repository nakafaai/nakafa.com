import { FunctionSpec, GroupSpec } from "@confect/core";
import { PaginationOptions as PaginationOptionsSchema } from "@confect/core/PaginationOptions";
import { PaginationResult as PaginationResultSchema } from "@confect/core/PaginationResult";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import commentsTable from "@repo/backend/confect/_generated/tables/comments";
import { AuthFailure } from "@repo/backend/confect/auth/spec";
import { commentVoteValidator } from "@repo/backend/confect/comments/schema";
import { userDataValidator } from "@repo/backend/confect/lib/validators/user";
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
    FunctionSpec.publicQuery({
      name: "getCommentsBySlug",
      args: () => ({
        slug: Schema.String,
        paginationOpts: PaginationOptionsSchema,
      }),
      returns: () => PaginationResultSchema(commentWithUserValidator),
      error: () => AuthFailure,
    })
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "getCommentsByUserId",
      args: () => ({
        userId: IdSchema("users"),
        paginationOpts: PaginationOptionsSchema,
      }),
      returns: () => PaginationResultSchema(commentWithViewerVoteValidator),
      error: () => AuthFailure,
    })
  );
