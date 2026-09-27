import { FunctionSpec, GroupSpec } from "@confect/core";
import { ReleaseError } from "@repo/backend/confect/contentRelease/error";
import {
  artifactLocaleValidator,
  contentHeadValidator,
} from "@repo/backend/confect/contentRelease/spec";
import { Schema } from "effect";
export const catalogCursorValidator = Schema.Struct({
  artifactLocale: artifactLocaleValidator,
  contentKey: Schema.String,
});
export const catalogPageValidator = Schema.Struct({
  done: Schema.Boolean,
  heads: Schema.mutable(Schema.Array(contentHeadValidator)),
  nextCursor: Schema.Union([catalogCursorValidator, Schema.Null]),
});
export default GroupSpec.make().addFunction(
  FunctionSpec.internalQuery({
    name: "page",
    args: () => ({
      cursor: Schema.Union([catalogCursorValidator, Schema.Null]),
      releaseId: Schema.String,
    }),
    returns: () => catalogPageValidator,
    error: () => ReleaseError,
  })
);
