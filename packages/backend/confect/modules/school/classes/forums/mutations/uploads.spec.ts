import { FunctionSpec, GenericId, GroupSpec } from "@confect/core";
import { Schema } from "effect";

const classesForumsMutationsUploadsGroup = GroupSpec.make("uploads")
  .addFunction(
    FunctionSpec.publicMutation({
      name: "discardForumUploads",
      args: Schema.Struct({
        uploadIds: Schema.Array(
          GenericId.GenericId("schoolClassForumPendingUploads")
        ),
      }),
      returns: Schema.Null,
    })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "generateUploadUrl",
      args: Schema.Struct({
        forumId: GenericId.GenericId("schoolClassForums"),
      }),
      returns: Schema.Struct({
        uploadId: GenericId.GenericId("schoolClassForumPendingUploads"),
        uploadUrl: Schema.String,
      }),
    })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "saveForumUpload",
      args: Schema.Struct({
        name: Schema.String,
        size: Schema.Number,
        storageId: GenericId.GenericId("_storage"),
        type: Schema.String,
        uploadId: GenericId.GenericId("schoolClassForumPendingUploads"),
      }),
      returns: GenericId.GenericId("schoolClassForumPendingUploads"),
    })
  );

export { classesForumsMutationsUploadsGroup };
