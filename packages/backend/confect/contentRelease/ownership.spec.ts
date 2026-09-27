import { FunctionSpec, GroupSpec } from "@confect/core";
import { ReleaseErrorWire } from "@repo/backend/confect/contentRelease/error";
import {
  appLocaleValidator,
  contentFamilyValidator,
} from "@repo/backend/confect/contentRelease/spec";
import { routeResultValidator } from "@repo/backend/content/publication/spec";
import { Schema } from "effect";

/** Returns active public-route ownership without exposing artifact code. */
export default GroupSpec.make().addFunction(
  FunctionSpec.publicQuery({
    name: "resolve",
    args: () => ({
      family: contentFamilyValidator,
      appLocale: appLocaleValidator,
      publicPath: Schema.String,
    }),
    returns: () => routeResultValidator,
    error: () => ReleaseErrorWire,
  })
);
