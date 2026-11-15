import { Id } from "@repo/backend/confect/_generated/id";
import { Schema } from "effect";

/** What each reminder job carries: the attempt, the end it was scheduled for, and the set's title in its language. */
export const ReminderJob = Schema.Struct({
  attemptId: Id("tryoutAttempts"),
  expiresAt: Schema.Finite,
  setTitle: Schema.String,
});

/** When a reminder may leave: now, at the end of quiet hours, or never, when quiet hours would hold it too long. */
export const ReminderTime = Schema.Union([
  Schema.TaggedStruct("Now", {}),
  Schema.TaggedStruct("At", { at: Schema.Finite }),
  Schema.TaggedStruct("Never", {}),
]);
