import { FunctionSpec, GroupSpec } from "@confect/core";
import { ReleaseError } from "@repo/backend/confect/contentRelease/error";
import { Schema } from "effect";
export const pageCatalogValidator = Schema.Struct({
  activeReleaseId: Schema.Union([Schema.String, Schema.Null]),
  managed: Schema.Boolean,
  projectionJson: Schema.mutable(Schema.Array(Schema.String)),
});

/** Returns every verified locale-equivalent Page projection in one release. */
export default GroupSpec.make().addFunction(
  FunctionSpec.publicQuery({
    name: "catalog",
    args: () => ({}),
    returns: () => pageCatalogValidator,
    error: () => ReleaseError,
  })
);
