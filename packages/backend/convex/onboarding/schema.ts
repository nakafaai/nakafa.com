import {
  onboardingFocuses,
  onboardingRegions,
} from "@repo/backend/convex/onboarding/values";
import { selfSelectableUserRoleValidator } from "@repo/backend/convex/users/schema";
import { defineTable } from "convex/server";
import type { Infer } from "convex/values";
import { v } from "convex/values";
import { literals } from "convex-helpers/validators";

export const onboardingRegionValidator = literals(...onboardingRegions);
export const onboardingFocusValidator = literals(...onboardingFocuses);

export type OnboardingRegion = Infer<typeof onboardingRegionValidator>;
export type OnboardingFocus = Infer<typeof onboardingFocusValidator>;

export const onboardingCompletionValidator = v.object({
  focus: onboardingFocusValidator,
  region: onboardingRegionValidator,
  role: selfSelectableUserRoleValidator,
});
export type OnboardingCompletion = Infer<typeof onboardingCompletionValidator>;

export const onboardingAnswerValidator = v.union(
  v.object({
    kind: v.literal("role"),
    value: selfSelectableUserRoleValidator,
  }),
  v.object({
    kind: v.literal("region"),
    value: onboardingRegionValidator,
  }),
  v.object({
    kind: v.literal("focus"),
    value: onboardingFocusValidator,
  })
);

export const onboardingProfileValidator = v.object({
  completedAt: v.optional(v.number()),
  focus: v.optional(onboardingFocusValidator),
  region: v.optional(onboardingRegionValidator),
  role: v.optional(selfSelectableUserRoleValidator),
  updatedAt: v.number(),
});

export const currentOnboardingProfileValidator = v.union(
  v.null(),
  onboardingProfileValidator
);

export const onboardingStatusValidator = v.union(
  v.object({
    isAuthenticated: v.literal(false),
    isRequired: v.literal(false),
    profile: v.null(),
  }),
  v.object({
    isAuthenticated: v.literal(true),
    isRequired: v.boolean(),
    profile: currentOnboardingProfileValidator,
  })
);

const tables = {
  onboardingProfiles: defineTable({
    admittedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    focus: v.optional(onboardingFocusValidator),
    region: v.optional(onboardingRegionValidator),
    role: v.optional(selfSelectableUserRoleValidator),
    startedAt: v.optional(v.number()),
    updatedAt: v.number(),
    userId: v.id("users"),
  }).index("by_userId", ["userId"]),
};

export default tables;
