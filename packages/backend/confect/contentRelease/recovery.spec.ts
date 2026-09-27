import { FunctionSpec, GroupSpec } from "@confect/core";
import { ReleaseErrorWire } from "@repo/backend/confect/contentRelease/error";
import { publicationReceiptValidator } from "@repo/backend/confect/contentRelease/spec";
import { Schema } from "effect";

/** Exact stored recovery result returned to the authenticated Node verifier. */
export const recoveryLookupValidator = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal("missing"),
  }),
  Schema.Struct({
    kind: Schema.Literal("completed"),
    value: Schema.Struct({
      receipt: publicationReceiptValidator,
      releaseJson: Schema.String,
      rendererJson: Schema.String,
    }),
  }),
]);

/** Proves one recovery manifest is the exact inverse of its candidate. */
export default GroupSpec.make().addFunction(
  FunctionSpec.internalQuery({
    name: "lookup",
    args: () => ({
      recoveryId: Schema.String,
      releaseId: Schema.String,
    }),
    returns: () => recoveryLookupValidator,
    error: () => ReleaseErrorWire,
  })
);
