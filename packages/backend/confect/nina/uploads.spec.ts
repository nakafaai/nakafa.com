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

export const NinaUpload = Schema.Struct({
  userId: Id("users"),
  expiresAt: Schema.Finite,
  // True when the upload sealed its file name at reservation (ADR 0024). An upload
  // reserved before sealing has no such field, so its name is read as it is.
  nameSealed: Schema.optionalKey(Schema.Literal(true)),
  state: Schema.Union([
    Schema.Struct({ status: Schema.Literal("uploading") }),
    Schema.Struct({ status: Schema.Literal("ready"), fileId: Schema.String }),
  ]),
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
  // Reserves a place for an upload, and seals the name its file is stored under.
  .addFunction(
    FunctionSpec.internalMutation({
      name: "reserve",
      args: () => ({ filename: NinaFilename }),
      returns: () =>
        Schema.Struct({
          storedFilename: Schema.String,
          uploadId: Id("ninaUploads"),
        }),
      error: () => Schema.Union([AuthFailure, NinaUploadError]),
    }).middleware(Session)
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "complete",
      args: () => ({ uploadId: Id("ninaUploads"), fileId: Schema.String }),
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
