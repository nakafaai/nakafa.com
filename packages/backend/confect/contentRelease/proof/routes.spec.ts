import { FunctionSpec, GroupSpec } from "@confect/core";
import { ReleaseError } from "@repo/backend/confect/contentRelease/error";
import { Schema } from "effect";
export const routeCatalogValidator = Schema.Struct({
  checked: Schema.Finite,
  done: Schema.Boolean,
  nextCursor: Schema.Union([Schema.String, Schema.Null]),
});
export default GroupSpec.make().addFunction(
  FunctionSpec.internalQuery({
    name: "routes",
    args: () => ({
      cursor: Schema.Union([Schema.String, Schema.Null]),
      releaseId: Schema.String,
    }),
    returns: () => routeCatalogValidator,
    error: () => ReleaseError,
  })
);
