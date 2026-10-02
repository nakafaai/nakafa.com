import { FunctionSpec, GroupSpec } from "@confect/core";
import { AuthFailure } from "@repo/backend/confect/auth/spec";
import { ReleaseError } from "@repo/backend/confect/contentRelease/error";
import Session from "@repo/backend/confect/middleware/session.spec";
import { TryoutRuntimeErrorWire } from "@repo/backend/confect/tryouts/runtime/error";
import {
  listArgsValidator,
  PublishedSetPaginationError,
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
        ReleaseError,
        PublishedSetPaginationError,
        TryoutRuntimeErrorWire,
      ]),
  }).middleware(Session)
);
