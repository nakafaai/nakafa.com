import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { AuthFailure } from "@repo/backend/confect/auth/spec";
import { StorageFull } from "@repo/backend/confect/bucket/errors";
import { CommentWriteError } from "@repo/backend/confect/comments/errors";
import { Pixels } from "@repo/backend/confect/comments/photo";
import Session from "@repo/backend/confect/middleware/session.spec";
import { ImageType } from "@repo/editor/upload";
import { Schema } from "effect";

/**
 * The photos of comments (ADR 0028). A learner reserves each file, a photo and its small copy, before any
 * byte moves, uploads it straight to R2 at the address the reservation answers, then registers the photo:
 * the server reads its size and leading bytes from R2, keeps an image, and deletes any other file. A
 * registered photo waits for the comment that posts it, and a daily sweep deletes one that stays
 * unposted. `commit` and `sweep` are internal.
 */
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.publicMutation({
      name: "reserve",
      args: () => ({
        byteSize: Schema.Int.check(Schema.isGreaterThan(0)),
        contentType: ImageType,
      }),
      returns: () =>
        Schema.Struct({ address: Schema.String, fileId: Id("bucketFiles") }),
      error: () => Schema.Union([AuthFailure, CommentWriteError, StorageFull]),
    }).middleware(Session)
  )
  .addFunction(
    FunctionSpec.publicAction({
      name: "register",
      args: () => ({
        fileId: Id("bucketFiles"),
        height: Pixels,
        thumbnailId: Schema.NullOr(Id("bucketFiles")),
        width: Pixels,
      }),
      returns: () => Id("commentUploads"),
      error: () => Schema.Union([AuthFailure, CommentWriteError]),
    }).middleware(Session)
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "withdraw",
      args: () => ({ uploadId: Id("commentUploads") }),
      returns: () => Schema.Null,
      error: () => Schema.Union([AuthFailure, CommentWriteError]),
    }).middleware(Session)
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "commit",
      args: () => ({
        fileId: Id("bucketFiles"),
        height: Pixels,
        thumbnailId: Schema.NullOr(Id("bucketFiles")),
        userId: Id("users"),
        width: Pixels,
      }),
      returns: () => Id("commentUploads"),
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "sweep",
      args: () => ({}),
      returns: () => Schema.Struct({ deleted: Schema.Int }),
    })
  );
