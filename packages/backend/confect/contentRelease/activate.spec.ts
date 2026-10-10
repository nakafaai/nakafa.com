import { FunctionSpec, GroupSpec } from "@confect/core";
import {
  activationResultValidator,
  preparationResultValidator,
} from "@repo/backend/confect/contentRelease/activation/spec";
import { ReleaseError } from "@repo/backend/confect/contentRelease/error";
import { Schema } from "effect";

const activationArgs = {
  manifestHash: Schema.String,
  releaseId: Schema.String,
  rendererJson: Schema.String,
};

/** Starts or resumes candidate-safe read-model preparation. */
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.internalMutation({
      name: "prepare",
      args: () => activationArgs,
      returns: () => preparationResultValidator,
      error: () => ReleaseError,
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "activate",
      args: () => activationArgs,
      returns: () => activationResultValidator,
      error: () => ReleaseError,
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "prepareRecovery",
      args: () => activationArgs,
      returns: () => preparationResultValidator,
      error: () => ReleaseError,
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "activateRecovery",
      args: () => activationArgs,
      returns: () => activationResultValidator,
      error: () => ReleaseError,
    })
  );
