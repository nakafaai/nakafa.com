import { GenericId, Table } from "@confect/core";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import { Schema } from "effect";
export default Table.make(() =>
  Schema.Struct({
    forumId: IdSchema("schoolClassForums"),
    classId: IdSchema("schoolClasses"),
    expiresAt: Schema.Finite,
    uploadToken: Schema.String,
    uploadedBy: IdSchema("users"),
    uploadLease: Schema.optionalKey(
      Schema.Struct({
        expiresAt: Schema.Finite,
        id: Schema.String,
      })
    ),
    storageId: Schema.optionalKey(GenericId.GenericId("_storage")),
    name: Schema.optionalKey(Schema.String),
    mimeType: Schema.optionalKey(Schema.String),
    size: Schema.optionalKey(Schema.Finite),
  })
)
  .index("by_storageId", ["storageId"])
  .index("by_forumId_and_uploadedBy", ["forumId", "uploadedBy"])
  .index("by_uploadedBy", ["uploadedBy"]);
