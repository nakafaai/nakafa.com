import { FunctionSpec, GroupSpec } from "@confect/core";
import { ReleaseError } from "@repo/backend/confect/contentRelease/error";
import { appLocaleValidator } from "@repo/backend/confect/contentRelease/spec";
import {
  publicBatchResultValidator,
  publicRequestValidator,
  publicResultValidator,
} from "@repo/backend/content/publication/spec";
import { Schema } from "effect";
/** Returns one public artifact only to the server-authenticated HTTP adapter. */
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.internalQuery({
      name: "read",
      args: () => ({
        appLocale: appLocaleValidator,
        publicPath: Schema.String,
      }),
      returns: () => publicResultValidator,
      error: () => ReleaseError,
    })
  )
  .addFunction(
    FunctionSpec.internalQuery({
      name: "readBatch",
      args: () => ({
        requests: Schema.mutable(Schema.Array(publicRequestValidator)),
      }),
      returns: () => publicBatchResultValidator,
      error: () => ReleaseError,
    })
  );
