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
