import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { JournalCursorTooLarge } from "@repo/backend/confect/journal/errors";
import { Schema } from "effect";

/**
 * Writes the inbox rows of invitations. `run` reads one page of a school's
 * invitations in its cursor's window, and fails with `JournalCursorTooLarge`
 * before it writes when the window is over its bound. `sweep` runs on a minute
 * cron and starts a run for each cursor that a change left pending, if the run
 * never happened.
 */
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.internalMutation({
      name: "run",
      args: () => ({ tenantId: Id("tenants") }),
      error: () => JournalCursorTooLarge,
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
