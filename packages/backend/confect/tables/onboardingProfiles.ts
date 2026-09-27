import { Table } from "@confect/core";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import {
  onboardingFocusValidator,
  onboardingRegionValidator,
} from "@repo/backend/confect/onboarding/schema";
import { selfSelectableUserRoleValidator } from "@repo/backend/confect/users/schema";
import { Schema } from "effect";
export default Table.make(() =>
  Schema.Struct({
    admittedAt: Schema.optionalKey(Schema.Finite),
    completedAt: Schema.optionalKey(Schema.Finite),
    focus: Schema.optionalKey(onboardingFocusValidator),
    region: Schema.optionalKey(onboardingRegionValidator),
    role: Schema.optionalKey(selfSelectableUserRoleValidator),
    startedAt: Schema.optionalKey(Schema.Finite),
    updatedAt: Schema.Finite,
    userId: IdSchema("users"),
  })
).index("by_userId", ["userId"]);
