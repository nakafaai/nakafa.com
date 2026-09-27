import { FunctionSpec, GenericId, GroupSpec } from "@confect/core";
import Atomic from "@repo/backend/confect/middleware/atomic.spec";
import { Schema } from "effect";
export const forumAttachmentUploadOutcomeValidator = Schema.Literals([
  "accepted",
  "discarded",
  "rejected",
]);
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.internalMutation({
      name: "cleanup",
      args: () => ({ storageId: GenericId.GenericId("_storage") }),
      returns: () => Schema.Null,
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "claim",
      args: () => ({
        leaseId: Schema.String,
        uploadId: Schema.String,
        uploadToken: Schema.String,
      }),
      returns: () => Schema.Boolean,
    }).middleware(Atomic)
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "release",
      args: () => ({
        leaseId: Schema.String,
        uploadId: Schema.String,
      }),
      returns: () => Schema.Null,
    }).middleware(Atomic)
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "settle",
      args: () => ({
        contentType: Schema.String,
        leaseId: Schema.String,
        size: Schema.Finite,
        storageId: GenericId.GenericId("_storage"),
        uploadId: Schema.String,
        uploadToken: Schema.String,
      }),
      returns: () => forumAttachmentUploadOutcomeValidator,
    }).middleware(Atomic)
  );
