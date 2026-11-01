import { Id } from "@repo/backend/confect/_generated/id";
import { NoticeKind } from "@repo/backend/confect/notifications/rules";
import { Schema } from "effect";

/** A channel a person can switch off. The inbox always keeps its row. */
export const PreferenceChannel = Schema.Literals(["push", "email"]);

/** What every choice holds: the channel of the kind that was switched off. */
const preferenceFields = { channel: PreferenceChannel, kind: NoticeKind };

/**
 * One channel of one kind that someone switched off: a Person of a school, or an account for a notice no school holds.
 * Every other channel stays on, so no row means on (ADR 0027).
 */
export const noticePreferenceValidator = Schema.Union([
  Schema.Struct({
    ...preferenceFields,
    personId: Id("tenantPeople"),
    tenantId: Id("tenants"),
  }),
  Schema.Struct({ ...preferenceFields, userId: Id("users") }),
]);

/** A channel of a kind that someone switched off, as their settings read it. */
export const SwitchedOff = Schema.Struct({
  channel: PreferenceChannel,
  kind: NoticeKind,
});
