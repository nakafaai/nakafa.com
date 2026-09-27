import { FunctionSpec, GenericId, GroupSpec } from "@confect/core";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import { AuthFailure } from "@repo/backend/confect/auth/spec";
import { ClassAccessError } from "@repo/backend/confect/classes/access/spec";
import {
  ForumAttachmentError,
  ForumAttachmentIoErrorWire,
  ForumAttachmentUploadConfigError,
} from "@repo/backend/confect/classes/forums/attachments/spec";
import { ForumError } from "@repo/backend/confect/classes/forums/spec";
import { forumUploadUrlResultValidator } from "@repo/backend/confect/classes/forums/validators";
import Atomic from "@repo/backend/confect/middleware/atomic.spec";
import Session from "@repo/backend/confect/middleware/session.spec";
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
          ForumAttachmentUploadConfigError,
          ForumAttachmentError,
          ClassAccessError,
          ForumError,
        ]),
    })
      .middleware(Session)
      .middleware(Atomic)
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
          ForumAttachmentError,
          ForumError,
          ClassAccessError,
        ]),
    })
      .middleware(Session)
      .middleware(Atomic)
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
    })
      .middleware(Session)
      .middleware(Atomic)
  );
