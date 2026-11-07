import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { StorageFull } from "@repo/backend/confect/bucket/errors";
import { Schema } from "effect";

/** What the server reads of one file: where it is, how large, its declared type, and the school it is charged to. */
const FileFacts = Schema.Struct({
  byteSize: Schema.Int,
  contentType: Schema.String,
  objectKey: Schema.String,
  tenantId: Schema.NullOr(Id("tenants")),
});

/**
 * The files of the private R2 bucket (ADR 0028). Only the server calls these: an action reads a file's facts,
 * marks it stored once its bytes arrived, reserves and stores bytes it made itself, and removes deleted objects; the
 * daily sweep deletes files reserved for an upload that never arrived.
 */
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.internalQuery({
      name: "file",
      args: () => ({ fileId: Id("bucketFiles") }),
      returns: () => Schema.NullOr(FileFacts),
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "markStored",
      args: () => ({ fileId: Id("bucketFiles") }),
      returns: () => Schema.Null,
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "reserveStored",
      args: () => ({
        byteSize: Schema.Int.check(Schema.isGreaterThan(0)),
        contentType: Schema.String,
        tenantId: Schema.NullOr(Id("tenants")),
      }),
      returns: () =>
        Schema.Struct({ fileId: Id("bucketFiles"), objectKey: Schema.String }),
      error: () => StorageFull,
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "discard",
      args: () => ({ fileId: Id("bucketFiles") }),
      returns: () => Schema.Null,
    })
  )
  .addFunction(
    FunctionSpec.internalAction({
      name: "removeObjects",
      args: () => ({ keys: Schema.Array(Schema.String) }),
      returns: () => Schema.Null,
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "sweep",
      args: () => ({}),
      returns: () => Schema.Null,
    })
  );
