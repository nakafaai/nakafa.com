import { v } from "convex/values";

export const releaseIdentityValidator = v.object({
  manifestHash: v.string(),
  releaseId: v.string(),
  sequence: v.number(),
});

export const retirementHistoryValidator = v.object({
  active: releaseIdentityValidator,
  releases: v.array(releaseIdentityValidator),
});

export const retirementAttemptValidator = v.object({
  attemptId: v.id("tryoutAttempts"),
  bundleHash: v.string(),
  runtimeId: v.id("tryoutRuntimeBundles"),
  source: releaseIdentityValidator,
  startedAt: v.number(),
});
