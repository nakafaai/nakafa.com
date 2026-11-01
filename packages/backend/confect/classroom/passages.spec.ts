import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { PassageView } from "@repo/backend/confect/classroom/passages";
import { Schema } from "effect";

/**
 * The index of the class libraries (ADR 0023): a published file is read into passages and embedded, each passage kept
 * sealed beside its vector, and it leaves with the file or when the school turns Nina off. All of it is internal.
 */
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.internalQuery({
      name: "source",
      args: () => ({ itemId: Id("classroomLibrary") }),
      returns: () =>
        Schema.NullOr(
          Schema.Struct({
            contentType: Schema.String,
            storageId: Id("_storage"),
          })
        ),
    })
  )
  .addFunction(
    FunctionSpec.internalAction({
      name: "build",
      args: () => ({ itemId: Id("classroomLibrary") }),
      returns: () => Schema.Null,
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "store",
      args: () => ({
        itemId: Id("classroomLibrary"),
        passages: Schema.Array(
          Schema.Struct({
            embedding: Schema.Array(Schema.Finite),
            text: Schema.String,
          })
        ),
      }),
      returns: () => Schema.Null,
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "clear",
      args: () => ({ tenantId: Id("tenants") }),
      returns: () => Schema.Null,
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "rebuild",
      args: () => ({
        cursor: Schema.NullOr(Schema.String),
        tenantId: Id("tenants"),
      }),
      returns: () => Schema.Null,
    })
  )
  .addFunction(
    FunctionSpec.internalQuery({
      name: "open",
      args: () => ({ ids: Schema.Array(Id("classroomPassages")) }),
      returns: () => Schema.Array(PassageView),
    })
  );
