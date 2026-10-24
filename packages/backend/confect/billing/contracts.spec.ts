import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import { TenantNotFound } from "@repo/backend/confect/billing/spec";
import Atomic from "@repo/backend/confect/middleware/atomic.spec";
import { Schema } from "effect";

/**
 * The operator command that records one signed school contract. It is internal:
 * no client calls it, and an operator runs it from the Convex dashboard or CLI.
 */
export default GroupSpec.make().addFunction(
  FunctionSpec.internalMutation({
    name: "recordSchoolContract",
    args: () => ({
      tenantSlug: Schema.String,
      contractId: Schema.String,
      seats: Schema.Int.check(Schema.isGreaterThanOrEqualTo(1)),
      validFrom: Schema.Finite,
      validTo: Schema.Finite,
    }),
    returns: () =>
      Schema.Struct({
        accountId: IdSchema("billingAccounts"),
        grantId: IdSchema("billingGrants"),
      }),
    error: () => TenantNotFound,
  }).middleware(Atomic)
);
