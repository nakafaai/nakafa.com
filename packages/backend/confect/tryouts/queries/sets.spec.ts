import { FunctionSpec, GroupSpec } from "@confect/core";
import { AuthFailure } from "@repo/backend/confect/auth/spec";
import { ReleaseErrorWire } from "@repo/backend/confect/contentRelease/error";
import {
  listArgsValidator,
  PublishedSetPaginationErrorWire,
  trackSetPageValidator,
} from "@repo/backend/confect/tryouts/sets/spec";
import { Schema } from "effect";

/** Lists signed sets with combined status filtering and stable sorting. */
export default GroupSpec.make().addFunction(
  FunctionSpec.publicQuery({
    name: "list",
    args: () => listArgsValidator.fields,
    returns: () => trackSetPageValidator,
    error: () =>
      Schema.Union([
        AuthFailure,
        ReleaseErrorWire,
        PublishedSetPaginationErrorWire,
      ]),
  })
);
