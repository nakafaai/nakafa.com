import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { Schema } from "effect";

/** One coming event as Nina reads it: its title, when it starts and ends in UTC, and whether it is a whole day. */
const UpcomingEvent = Schema.Struct({
  allDay: Schema.Boolean,
  end: Schema.Finite,
  start: Schema.Finite,
  title: Schema.String,
});

/**
 * The Calendar mirror as Nina reads it for one account (ADR 0015, journey J8):
 * the account's own events that end after `from` and start before `until`, the
 * soonest first, each title opened with the account's key. Internal: only Nina's
 * calendar capability reads it, for the learner of its turn.
 */
export default GroupSpec.make().addFunction(
  FunctionSpec.internalQuery({
    name: "upcoming",
    args: () => ({
      from: Schema.Finite,
      until: Schema.Finite,
      userId: Id("users"),
    }),
    returns: () => Schema.Array(UpcomingEvent),
  })
);
