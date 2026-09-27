import { FunctionSpec, GenericId, GroupSpec } from "@confect/core";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import { AuthFailure } from "@repo/backend/confect/auth/spec";
import { ClassAccessFailure } from "@repo/backend/confect/classes/access/spec";
import {
  ForumAttachmentErrorWire,
  ForumAttachmentIoErrorWire,
  ForumAttachmentUploadConfigErrorWire,
} from "@repo/backend/confect/classes/forums/attachments/spec";
import { ForumFailure } from "@repo/backend/confect/classes/forums/spec";
import { forumUploadUrlResultValidator } from "@repo/backend/confect/classes/forums/validators";
import Atomic from "@repo/backend/confect/middleware/atomic.spec";
import { Schema } from "effect";

/**
 * Create an upload URL for one new forum post attachment.
 */
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.publicMutation({
      name: "generateUploadUrl",
      args: () => ({
        forumId: IdSchema("schoolClassForums"),
      }),
      returns: () => forumUploadUrlResultValidator,
      error: () =>
        Schema.Union([
          AuthFailure,
          ForumAttachmentUploadConfigErrorWire,
          ForumAttachmentErrorWire,
          ClassAccessFailure,
          ForumFailure,
        ]),
    }).middleware(Atomic)
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "saveForumUpload",
      args: () => ({
        uploadId: IdSchema("schoolClassForumPendingUploads"),
        storageId: GenericId.GenericId("_storage"),
        name: Schema.String,
        size: Schema.Finite,
        type: Schema.String,
      }),
      returns: () => IdSchema("schoolClassForumPendingUploads"),
      error: () =>
        Schema.Union([
          AuthFailure,
          ForumAttachmentIoErrorWire,
          ForumAttachmentErrorWire,
          ForumFailure,
          ClassAccessFailure,
        ]),
    }).middleware(Atomic)
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "discardForumUploads",
      args: () => ({
        uploadIds: Schema.mutable(
          Schema.Array(IdSchema("schoolClassForumPendingUploads"))
        ),
      }),
      returns: () => Schema.Null,
      error: () => Schema.Union([AuthFailure, ForumAttachmentIoErrorWire]),
    }).middleware(Atomic)
  );
