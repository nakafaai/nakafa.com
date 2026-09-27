import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import { AuthFailure } from "@repo/backend/confect/auth/spec";
import { ClassAccessFailure } from "@repo/backend/confect/classes/access/spec";
import {
  ForumAttachmentErrorWire,
  ForumAttachmentIoErrorWire,
} from "@repo/backend/confect/classes/forums/attachments/spec";
import { ForumFailure } from "@repo/backend/confect/classes/forums/spec";
import Atomic from "@repo/backend/confect/middleware/atomic.spec";
import { Schema } from "effect";

/**
 * Create a new forum post.
 */
export default GroupSpec.make().addFunction(
  FunctionSpec.publicMutation({
    name: "createForumPost",
    args: () => ({
      attachmentUploadIds: Schema.optionalKey(
        Schema.mutable(Schema.Array(IdSchema("schoolClassForumPendingUploads")))
      ),
      body: Schema.String,
      forumId: IdSchema("schoolClassForums"),
      mentions: Schema.optionalKey(
        Schema.mutable(Schema.Array(IdSchema("users")))
      ),
      parentId: Schema.optionalKey(IdSchema("schoolClassForumPosts")),
    }),
    returns: () => IdSchema("schoolClassForumPosts"),
    error: () =>
      Schema.Union([
        AuthFailure,
        ForumAttachmentErrorWire,
        ForumAttachmentIoErrorWire,
        ForumFailure,
        ClassAccessFailure,
      ]),
  }).middleware(Atomic)
);
