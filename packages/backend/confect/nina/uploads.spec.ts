import { FunctionSpec, GroupSpec } from "@confect/core";
import {
  NinaFileType,
  NinaUploadError,
} from "@repo/backend/client/nina/uploads";
import { Id } from "@repo/backend/confect/_generated/id";
import { AuthFailure } from "@repo/backend/confect/auth/spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import { Schema } from "effect";

export const NinaUpload = Schema.Struct({
  userId: Id("users"),
  expiresAt: Schema.Finite,
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
        filename: Schema.NonEmptyString.check(Schema.isMaxLength(255)),
      }),
      returns: () => Id("ninaUploads"),
      error: () => Schema.Union([AuthFailure, NinaUploadError]),
    }).middleware(Session)
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "reserve",
      args: () => ({}),
      returns: () => Id("ninaUploads"),
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
