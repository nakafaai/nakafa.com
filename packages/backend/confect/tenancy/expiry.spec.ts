import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { Schema } from "effect";

/**
 * Marks invites expired when their term ends. `invite` is scheduled once, at the
 * moment the invite stores as its expiry, so no query reads the clock. `sweep`
 * runs on a cron and expires every due invite whose own run never happened.
 */
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.internalMutation({
      name: "invite",
      args: () => ({ inviteId: Id("tenantInvites") }),
      returns: () => Schema.Null,
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "sweep",
      args: () => ({}),
      returns: () => Schema.Null,
    })
  );
