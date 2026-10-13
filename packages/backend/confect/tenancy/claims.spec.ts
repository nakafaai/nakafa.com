import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { Schema } from "effect";

/**
 * Claims the pending invites that name an account's verified address, one page
 * at a time. Scheduled after sign-up, after an address is verified, and after
 * an invite is made for an address that an account already holds.
 */
export default GroupSpec.make().addFunction(
  FunctionSpec.internalMutation({
    name: "run",
    args: () => ({
      cursor: Schema.NullOr(Schema.String),
      userId: Id("users"),
    }),
    returns: () => Schema.Null,
  })
);
