import { FunctionSpec, GroupSpec } from "@confect/core";
import { ReleaseError } from "@repo/backend/confect/contentRelease/error";
import { Schema } from "effect";

/** Proves one release is an exact active or verified-candidate rollback source. */
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.internalQuery({
      name: "prepareRollback",
      args: () => ({
        afterIndex: Schema.Finite,
        limit: Schema.Finite,
        rollbackOf: Schema.String,
        rollbackOfManifestHash: Schema.String,
      }),
      returns: () => Schema.String,
      error: () => ReleaseError,
    })
  )
  .addFunction(
    FunctionSpec.internalQuery({
      name: "prepareRoutes",
      args: () => ({
        afterIndex: Schema.Finite,
        limit: Schema.Finite,
        rollbackOf: Schema.String,
        rollbackOfManifestHash: Schema.String,
      }),
      returns: () => Schema.String,
      error: () => ReleaseError,
    })
  );
