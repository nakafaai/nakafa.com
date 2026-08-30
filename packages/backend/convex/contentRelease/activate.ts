import { internalMutation } from "@repo/backend/convex/_generated/server";
import {
  activateCandidate,
  prepareCandidate,
} from "@repo/backend/convex/contentRelease/activation/candidate";
import {
  activateRecovery as activateRecoveryProgram,
  prepareRecovery as prepareRecoveryProgram,
} from "@repo/backend/convex/contentRelease/activation/recovery";
import {
  activationResultValidator,
  preparationResultValidator,
} from "@repo/backend/convex/contentRelease/activation/spec";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { v } from "convex/values";

const activationArgs = {
  manifestHash: v.string(),
  releaseId: v.string(),
  rendererJson: v.string(),
};

/** Starts or resumes candidate-safe read-model preparation. */
export const prepare = internalMutation({
  args: activationArgs,
  returns: preparationResultValidator,
  handler: (ctx, args) =>
    runConvexProgram(
      prepareCandidate(
        ctx,
        args.releaseId,
        args.rendererJson,
        args.manifestHash
      )
    ),
});

/** Atomically activates one candidate only after model readiness. */
export const activate = internalMutation({
  args: activationArgs,
  returns: activationResultValidator,
  handler: (ctx, args) =>
    runConvexProgram(
      activateCandidate(
        ctx,
        args.releaseId,
        args.rendererJson,
        args.manifestHash
      )
    ),
});

/** Starts or resumes recovery-safe read-model preparation. */
export const prepareRecovery = internalMutation({
  args: activationArgs,
  returns: preparationResultValidator,
  handler: (ctx, args) =>
    runConvexProgram(
      prepareRecoveryProgram(
        ctx,
        args.releaseId,
        args.rendererJson,
        args.manifestHash
      )
    ),
});

/** Atomically activates one recovery only after model readiness. */
export const activateRecovery = internalMutation({
  args: activationArgs,
  returns: activationResultValidator,
  handler: (ctx, args) =>
    runConvexProgram(
      activateRecoveryProgram(
        ctx,
        args.releaseId,
        args.rendererJson,
        args.manifestHash
      )
    ),
});
