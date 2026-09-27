import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import { ForumAttachmentIoErrorWire } from "@repo/backend/confect/classes/forums/attachments/spec";
import Atomic from "@repo/backend/confect/middleware/atomic.spec";
import { Schema } from "effect";
export default GroupSpec.make().addFunction(
  FunctionSpec.internalMutation({
    name: "deleteExpiredPendingUpload",
    args: () => ({
      uploadId: IdSchema("schoolClassForumPendingUploads"),
    }),
    returns: () => Schema.Null,
    error: () => ForumAttachmentIoErrorWire,
  }).middleware(Atomic)
);
