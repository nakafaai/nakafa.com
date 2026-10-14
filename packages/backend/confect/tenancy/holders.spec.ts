import { FunctionSpec, GroupSpec } from "@confect/core";
import { Email } from "@repo/backend/confect/tenancy/schema";
import { Schema } from "effect";

/**
 * Finds the accounts that hold an address, one page at a time, and schedules
 * the claim run of each. Scheduled after an invite is made for an address that
 * accounts may hold already, because no sign-in is coming to claim it.
 */
export default GroupSpec.make().addFunction(
  FunctionSpec.internalMutation({
    name: "schedule",
    args: () => ({ cursor: Schema.NullOr(Schema.String), email: Email }),
    returns: () => Schema.Null,
  })
);
