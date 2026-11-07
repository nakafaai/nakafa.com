import { FunctionSpec, GroupSpec } from "@confect/core";
import {
  NINA_FILENAME_LENGTH,
  NinaFileType,
  NinaUploadError,
} from "@repo/backend/client/nina/uploads";
import { Id } from "@repo/backend/confect/_generated/id";
import { AuthFailure } from "@repo/backend/confect/auth/spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import { Schema } from "effect";

/** The name a learner gives a file: nonempty, and within the length a name may have. */
const NinaFilename = Schema.NonEmptyString.check(
  Schema.isMaxCodePoints(NINA_FILENAME_LENGTH)
);

/**
 * A learner's file waiting for its message: its name sealed for the learner at reservation (ADR 0024), and once its
 * bytes are in the bucket, the file that holds them (ADR 0028).
 */
export const NinaUpload = Schema.Struct({
  userId: Id("users"),
  expiresAt: Schema.Finite,
  name: Schema.String,
  state: Schema.Union([
    Schema.Struct({ status: Schema.Literal("uploading") }),
    Schema.Struct({
      status: Schema.Literal("ready"),
      fileId: Id("bucketFiles"),
    }),
  ]),
});

/** A file a learner sent in a chat, kept until the chat is deleted, so every later turn can read it again. */
export const NinaFile = Schema.Struct({
  chatId: Id("chats"),
  fileId: Id("bucketFiles"),
  messageId: Schema.String,
});

export default GroupSpec.make()
  .addFunction(
    FunctionSpec.publicAction({
      name: "save",
      args: () => ({
        bytes: Schema.instanceOf(ArrayBuffer),
        mediaType: NinaFileType,
        filename: NinaFilename,
      }),
      returns: () => Id("ninaUploads"),
      error: () => Schema.Union([AuthFailure, NinaUploadError]),
    }).middleware(Session)
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "release",
      args: () => ({ uploadId: Id("ninaUploads") }),
      returns: () => Schema.Null,
      error: () => Schema.Union([AuthFailure, NinaUploadError]),
    }).middleware(Session)
  )
  // Reserves a place for an upload, and seals the name of its file.
  .addFunction(
    FunctionSpec.internalMutation({
      name: "reserve",
      args: () => ({ filename: NinaFilename }),
      returns: () => Id("ninaUploads"),
      error: () => Schema.Union([AuthFailure, NinaUploadError]),
    }).middleware(Session)
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "complete",
      args: () => ({ uploadId: Id("ninaUploads"), fileId: Id("bucketFiles") }),
      returns: () => Schema.Null,
      error: () => Schema.Union([AuthFailure, NinaUploadError]),
    }).middleware(Session)
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "discard",
      args: () => ({ uploadId: Id("ninaUploads") }),
      returns: () => Schema.Null,
    })
  );
