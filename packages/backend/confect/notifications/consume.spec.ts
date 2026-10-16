import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { Schema } from "effect";

/**
 * Writes the inbox rows of invitations. `run` reads one page of a school's
 * invitations after its cursor, writes their rows, and schedules the next run when
 * entries are left unread. `sweep` runs on a minute cron and starts a run for each
 * cursor that a change left pending, if the run never happened.
 */
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.internalMutation({
      name: "run",
      args: () => ({ tenantId: Id("tenants") }),
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
