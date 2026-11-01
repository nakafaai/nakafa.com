import { Id } from "@repo/backend/confect/_generated/id";
import { NoticeKind } from "@repo/backend/confect/notifications/rules";
import { Schema } from "effect";

/** A channel a person can switch off. The inbox always keeps its row. */
export const PreferenceChannel = Schema.Literals(["push", "email"]);

/** One channel of one kind that a Person switched off. Every other channel stays on, so no row means on (ADR 0027). */
export const noticePreferenceValidator = Schema.Struct({
  channel: PreferenceChannel,
  kind: NoticeKind,
  personId: Id("tenantPeople"),
  tenantId: Id("tenants"),
});

/** A channel of a kind that a Person switched off, as their settings read it. */
export const SwitchedOff = Schema.Struct({
  channel: PreferenceChannel,
  kind: NoticeKind,
});
