import { FunctionSpec, GroupSpec } from "@confect/core";
import { ReleaseError } from "@repo/backend/confect/contentRelease/error";
import { releaseRoleValidator } from "@repo/backend/confect/contentRelease/spec";
import { Schema } from "effect";
export const envelopeValidator = Schema.Struct({
  releaseJson: Schema.String,
  rendererJson: Schema.String,
});
export const stageEnvelopeValidator = Schema.Struct({
  ...envelopeValidator.fields,
  ...{
    role: releaseRoleValidator,
  },
});

/** Reads stored authenticated envelopes only for one exact manifest identity. */
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.internalQuery({
      name: "get",
      args: () => ({
        manifestHash: Schema.String,
        releaseId: Schema.String,
      }),
      returns: () => envelopeValidator,
      error: () => ReleaseError,
    })
  )
  .addFunction(
    FunctionSpec.internalQuery({
      name: "byRelease",
      args: () => ({
        releaseId: Schema.String,
      }),
      returns: () => stageEnvelopeValidator,
      error: () => ReleaseError,
    })
  );
