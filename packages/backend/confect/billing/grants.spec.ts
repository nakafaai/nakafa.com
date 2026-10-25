import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import { PlanSyncIoError } from "@repo/backend/confect/billing/spec";
import Atomic from "@repo/backend/confect/middleware/atomic.spec";
import { Schema } from "effect";

/**
 * Recomputes the plans of one user, or of one page of a school's members, from
 * their Pro grants. The scheduler runs them when a grant is written and at the
 * end of each grant, and a school projection pages through every member.
 */
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.internalMutation({
      name: "project",
      args: () => ({
        userId: IdSchema("users"),
      }),
      returns: () => Schema.Null,
      error: () => PlanSyncIoError,
    }).middleware(Atomic)
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "projectSchool",
      args: () => ({
        tenantId: IdSchema("tenants"),
        cursor: Schema.NullOr(Schema.String),
      }),
      returns: () => Schema.Null,
      error: () => PlanSyncIoError,
    }).middleware(Atomic)
  );
