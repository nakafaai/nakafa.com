import { Id } from "@repo/backend/confect/_generated/id";
import { CohortName } from "@repo/backend/confect/tenancy/cohort";
import { PersonName } from "@repo/backend/confect/tenancy/schema";
import { Sealed } from "@repo/backend/confect/vault/schema";
import { Schema } from "effect";

/** A student's national student number (NISN): ten digits. */
export const Nisn = Schema.String.check(Schema.isPattern(/^\d{10}$/u)).pipe(
  Schema.brand("@Nakafa/Nisn")
);

/**
 * A student's NISN as the roster keeps it: sealed with the school key, so only the
 * school's own functions read it, and blinded under the same key, so a guardian's
 * check compares blinds and reads no plain NISN (ADR 0034).
 */
const RosterNisn = Schema.Struct({ blind: Schema.String, sealed: Sealed });

/**
 * One student's roster row: the NISN, sealed and blinded under the school key. No
 * birth date and no NIK are stored. The row sits apart from the Person, because
 * every School function loads the Person and the NISN is a roster fact (ADR 0011).
 */
export const rosterEntryValidator = Schema.Struct({
  nisn: RosterNisn,
  personId: Id("tenantPeople"),
  tenantId: Id("tenants"),
});

/** A roster row as the school's staff see it: whether a NISN is on file, never the NISN itself. */
export const RosterView = Schema.Struct({
  hasNisn: Schema.Boolean,
  personId: Id("tenantPeople"),
});

/** The rows one apply call takes; an import of a larger file sends several batches. */
export const IMPORT_BATCH = 100;

/**
 * One student row of a Dapodik import, as the browser read it from the file (ADR 0015): the
 * name, the NISN, and the class group when the file names one.
 */
export const ImportRow = Schema.Struct({
  cohortName: Schema.optionalKey(CohortName),
  name: PersonName,
  nisn: Nisn,
});

/** What one batch did: the students it added, the ones it changed, and the rows it skipped. */
export const ImportSummary = Schema.Struct({
  added: Schema.Finite,
  changed: Schema.Finite,
  skipped: Schema.Finite,
});

/** One student of a period as the export writes them: the name, the NISN on file, and the class group. */
export const RosterLine = Schema.Struct({
  cohortName: CohortName,
  name: PersonName,
  nisn: Schema.NullOr(Nisn),
});
