import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import { AuthFailure } from "@repo/backend/confect/auth/spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import { Schema } from "effect";

/** Expected denial while writing a post or a like on it. */
export class PostWriteError extends Schema.TaggedError<PostWriteError>()(
  "PostWriteError",
  {
    code: Schema.Literals([
      "POST_TEXT_EMPTY",
      "POST_TEXT_TOO_LONG",
      "POST_NOT_FOUND",
      "FORBIDDEN",
    ]),
    message: Schema.String,
  }
) {}

/** Writes a learner's own posts, and the likes on the posts they may read. */
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.publicMutation({
      name: "create",
      args: () => ({
        text: Schema.String,
      }),
      returns: () => IdSchema("posts"),
      error: () => Schema.Union([AuthFailure, PostWriteError]),
    }).middleware(Session)
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "remove",
      args: () => ({
        postId: IdSchema("posts"),
      }),
      returns: () => Schema.Null,
      error: () => Schema.Union([AuthFailure, PostWriteError]),
    }).middleware(Session)
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "like",
      args: () => ({
        postId: IdSchema("posts"),
      }),
      returns: () => Schema.Null,
      error: () => Schema.Union([AuthFailure, PostWriteError]),
    }).middleware(Session)
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "unlike",
      args: () => ({
        postId: IdSchema("posts"),
      }),
      returns: () => Schema.Null,
      error: () => Schema.Union([AuthFailure, PostWriteError]),
    }).middleware(Session)
  );
