import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import commentsTable from "@repo/backend/confect/_generated/tables/comments";
import { AuthFailure } from "@repo/backend/confect/auth/spec";
import { CommentPhotoView } from "@repo/backend/confect/comments/photo";
import { appLocaleValidator } from "@repo/backend/confect/contentRelease/spec";
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
 * One comment as a list shows it: its stored fields, its photos with the addresses they are read at,
 * and whether the viewer liked it.
 */
const commentRowValidator = Schema.Struct({
  ...Struct.omit(commentsTable.Doc.fields, ["photos"]),
  liked: Schema.Boolean,
  photos: Schema.Array(CommentPhotoView),
});

/** The order of a page's comments: the most liked first, or the newest first. */
export const CommentSort = Schema.Literals(["top", "newest"]);
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
 * Reads the comments of a slug, in either order, and of a profile, the replies of a thread,
 * one comment, the page that holds it, and how many comments a slug holds. Anyone may read
 * them, signed in or not. A page of each list holds bounded rows, and each row says whether
 * the viewer liked it.
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
      // The address of a page, which anyone can write, so it is read as text.
      args: () => ({
        appLocale: appLocaleValidator,
        commentId: Schema.String,
      }),
      returns: () => Schema.NullOr(CommentPlace),
    })
  )
  .addFunction(
    FunctionSpec.publicPaginatedQuery({
      name: "getCommentsBySlug",
      args: () => ({
        slug: Schema.String,
        sort: CommentSort,
      }),
      item: () => commentWithUserValidator,
      error: () => AuthFailure,
    }).middleware(Session)
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "getCommentCount",
      args: () => ({
        slug: Schema.String,
      }),
      returns: () => Schema.Int,
    })
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
