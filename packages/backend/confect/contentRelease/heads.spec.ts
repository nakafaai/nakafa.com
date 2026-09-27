import { FunctionSpec, GroupSpec } from "@confect/core";
import { ReleaseErrorWire } from "@repo/backend/confect/contentRelease/error";
import {
  contentFamilyValidator,
  headPageValidator,
} from "@repo/backend/confect/contentRelease/spec";
import { Schema } from "effect";

/** Decodes one bounded active-head request into the exact shared contract. */
export default GroupSpec.make().addFunction(
  FunctionSpec.internalQuery({
    name: "page",
    args: () => ({
      activeManifestHash: Schema.String,
      activeReleaseId: Schema.String,
      cursor: Schema.Union([Schema.String, Schema.Null]),
      family: contentFamilyValidator,
      limit: Schema.Finite,
    }),
    returns: () => headPageValidator,
    error: () => ReleaseErrorWire,
  })
);
