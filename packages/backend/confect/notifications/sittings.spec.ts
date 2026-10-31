import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { Schema } from "effect";

/** The notices of a coming sitting: its start for the students it expects, and the reminder for their guardians. */
export const SittingNotice = Schema.Literals([
  "examStart",
  "examGuardianReminder",
]);

/**
 * Writes the inbox rows of a coming sitting, one page of the students it expects per run (ADR 0027). Scheduling the
 * sitting schedules the first run of each notice at the time the rules give it, and cancelling or closing the sitting
 * cancels the runs that have not started. It is internal.
 */
export default GroupSpec.make().addFunction(
  FunctionSpec.internalMutation({
    name: "run",
    args: () => ({
      cursor: Schema.NullOr(Schema.String),
      notice: SittingNotice,
      sittingId: Id("examSittings"),
    }),
    returns: () => Schema.Null,
  })
);
