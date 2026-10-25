import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import commentsTable from "@repo/backend/confect/_generated/tables/comments";
import { AuthFailure } from "@repo/backend/confect/auth/spec";
import { userDataValidator } from "@repo/backend/confect/lib/validators/user";
import Session from "@repo/backend/confect/middleware/session.spec";
import { Schema, Struct } from "effect";

const publicCommentUserValidator = Schema.Struct({
  _id: userDataValidator.fields._id,
  image: userDataValidator.fields.image,
  mascot: userDataValidator.fields.mascot,
  name: userDataValidator.fields.name,
  picture: userDataValidator.fields.picture,
});

/**
 * One comment as a list shows it: its stored fields, its count of likes (zero before
 * the count was kept), and whether the viewer liked it.
 */
const commentRowValidator = Schema.Struct({
  ...Struct.omit(commentsTable.Doc.fields, ["likeCount"]),
  likeCount: Schema.Finite,
  liked: Schema.Boolean,
});
const commentWithUserValidator = Schema.Struct({
  ...commentRowValidator.fields,
  user: Schema.NullOr(publicCommentUserValidator),
  replyToUser: Schema.NullOr(publicCommentUserValidator),
});

/**
 * Reads the comments of a slug and of a profile, and the replies of a thread. A page
 * of each list holds bounded rows, and each row says whether the viewer liked it.
 */
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
      name: "getCommentReplies",
      args: () => ({
        threadId: IdSchema("comments"),
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
      item: () => commentRowValidator,
      error: () => AuthFailure,
    }).middleware(Session)
  );
