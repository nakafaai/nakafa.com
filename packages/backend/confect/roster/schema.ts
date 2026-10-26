import { Id } from "@repo/backend/confect/_generated/id";
import { Sealed } from "@repo/backend/confect/vault/schema";
import { Schema } from "effect";

/** A student's national student number (NISN): ten digits. */
export const Nisn = Schema.String.check(Schema.isPattern(/^\d{10}$/)).pipe(
  Schema.brand("@Nakafa/Nisn")
);

/**
 * A student's NISN as the roster keeps it: sealed with the school key, so only the
 * school's own functions read it, and blinded under the same key, so a guardian's
 * check compares blinds and reads no plain NISN (ADR 0034).
 */
const RosterNisn = Schema.Struct({ blind: Schema.String, sealed: Sealed });

/**
 * One student's roster row. `underAgeLimit` is the only age value Nakafa keeps,
 * and a row without it counts as under the limit, so the consent gate and quiet
 * hours apply until the school sets it (ADR 0034). No birth date and no NIK are
 * stored. The row sits apart from the Person, because every School function loads
 * the Person and the flag is a roster fact (ADR 0011).
 */
export const rosterEntryValidator = Schema.Struct({
  nisn: Schema.optionalKey(RosterNisn),
  personId: Id("tenantPeople"),
  tenantId: Id("tenants"),
  underAgeLimit: Schema.optionalKey(Schema.Boolean),
});

/**
 * A roster row as the school's staff see it: whether a NISN is on file, never the
 * NISN itself, and the age flag, which is absent until the school sets it.
 */
export const RosterView = Schema.Struct({
  hasNisn: Schema.Boolean,
  personId: Id("tenantPeople"),
  underAgeLimit: Schema.optionalKey(Schema.Boolean),
});
