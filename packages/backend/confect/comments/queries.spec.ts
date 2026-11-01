import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import commentsTable from "@repo/backend/confect/_generated/tables/comments";
import { AuthFailure } from "@repo/backend/confect/auth/spec";
import { appLocaleValidator } from "@repo/backend/confect/contentRelease/spec";
import { userDataValidator } from "@repo/backend/confect/lib/validators/user";
import Session from "@repo/backend/confect/middleware/session.spec";
import { Schema } from "effect";

const publicCommentUserValidator = Schema.Struct({
  _id: userDataValidator.fields._id,
  image: userDataValidator.fields.image,
  mascot: userDataValidator.fields.mascot,
  name: userDataValidator.fields.name,
  picture: userDataValidator.fields.picture,
});

/** One comment as a list shows it: its stored fields, and whether the viewer liked it. */
const commentRowValidator = Schema.Struct({
  ...commentsTable.Doc.fields,
  liked: Schema.Boolean,
});
const commentWithUserValidator = Schema.Struct({
  ...commentRowValidator.fields,
  user: Schema.NullOr(publicCommentUserValidator),
  replyToUser: Schema.NullOr(publicCommentUserValidator),
});

/** The page that shows a comment: its language, and its public path in that language. */
const CommentPlace = Schema.Struct({
  appLocale: appLocaleValidator,
  publicPath: Schema.String,
});

/**
 * Reads the comments of a slug and of a profile, the replies of a thread, one comment,
 * and the page that holds it. A page of each list holds bounded rows, and each row says
 * whether the viewer liked it.
 */
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.publicQuery({
      name: "getComment",
      args: () => ({
        commentId: IdSchema("comments"),
      }),
      returns: () => Schema.NullOr(commentWithUserValidator),
      error: () => AuthFailure,
    }).middleware(Session)
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "getCommentPlace",
      args: () => ({
        appLocale: appLocaleValidator,
        commentId: IdSchema("comments"),
      }),
      returns: () => Schema.NullOr(CommentPlace),
    })
  )
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
