import type { GenericId } from "@confect/core";
import type {
  TenantPeopleDoc,
  TenantPeriodsDoc,
} from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { assignRole } from "@repo/backend/confect/access/grant";
import type { TenantActor } from "@repo/backend/confect/journal/schema";
import {
  blindNisn,
  blindSourcedId,
  writeRosterEntry,
  writeSourcedId,
} from "@repo/backend/confect/roster/entry";
import type {
  ImportRow,
  SourcedRow,
} from "@repo/backend/confect/roster/schema";
import {
  personAuthority,
  placementOf,
  studentOf,
} from "@repo/backend/confect/tenancy/authority";
import { cohortNameKey } from "@repo/backend/confect/tenancy/cohort";
import { createPerson } from "@repo/backend/confect/tenancy/create";
import type { TenantKeys } from "@repo/backend/confect/vault/keys";
import { Array as Arr, Effect, Option } from "effect";

/** What applying one row did: a new student, a changed one, or a row it skipped. */
type RowOutcome = "added" | "changed" | "skipped";

/** The student whose roster row holds this NISN in the school, if any. */
const studentByNisn = Effect.fn("roster.import.byNisn")(function* (
  keys: TenantKeys,
  tenantId: GenericId.GenericId<"tenants">,
  nisn: (typeof ImportRow.Type)["nisn"]
) {
  const blind = yield* blindNisn(keys, nisn);
  const entry = yield* (yield* DatabaseReader)
    .table("rosterEntries")
    .index("by_tenantId_and_nisn_blind", (query) =>
      query.eq("tenantId", tenantId).eq("nisn.blind", blind)
    )
    .first()
    .pipe(Effect.orDie);
  return Option.map(entry, (row) => row.personId);
});

/** The student whose roster row holds this source's identity in the school, if any. */
const studentBySource = Effect.fn("roster.import.bySource")(function* (
  keys: TenantKeys,
  tenantId: GenericId.GenericId<"tenants">,
  sourcedId: string
) {
  const blind = yield* blindSourcedId(keys, sourcedId);
  const entry = yield* (yield* DatabaseReader)
    .table("rosterEntries")
    .index("by_tenantId_and_sourcedId", (query) =>
      query.eq("tenantId", tenantId).eq("sourcedId", blind)
    )
    .first()
    .pipe(Effect.orDie);
  return Option.map(entry, (row) => row.personId);
});

/** The active cohort of a period that holds a class group name, if any. */
const cohortNamed = Effect.fn("roster.import.cohort")(function* (
  period: TenantPeriodsDoc,
  name: string
) {
  const cohort = yield* (yield* DatabaseReader)
    .table("tenantCohorts")
    .index("by_periodId_and_nameKey", (query) =>
      query.eq("periodId", period._id).eq("nameKey", cohortNameKey(name))
    )
    .first()
    .pipe(Effect.orDie);
  return Option.filter(cohort, (row) => row.status === "active");
});

/**
 * Places a student in the class group a row names, when the period holds an active cohort
 * of that name and the student has no placement in the period yet. A row whose class group
 * the period does not hold keeps the student unplaced, for the Admin to place by hand.
 */
const placeNamed = Effect.fn("roster.import.place")(function* (
  actor: typeof TenantActor.Type,
  person: TenantPeopleDoc,
  period: TenantPeriodsDoc,
  name: string
) {
  const cohort = yield* cohortNamed(period, name);
  if (
    Option.isNone(cohort) ||
    Option.isSome(yield* placementOf(period._id, person._id))
  ) {
    return;
  }
  yield* (yield* DatabaseWriter)
    .table("tenantCohortMembers")
    .insert({
      cohortId: cohort.value._id,
      periodId: period._id,
      personId: person._id,
      tenantId: period.tenantId,
    })
    .pipe(Effect.orDie);
  yield* personAuthority.record(actor, person, {
    cohort: cohort.value._id,
    type: "person.placed",
  });
});

/** What one batch did, from the outcome of each of its rows. */
export const importSummary = (outcomes: readonly RowOutcome[]) => {
  const count = (outcome: RowOutcome) =>
    Arr.length(Arr.filter(outcomes, (found) => found === outcome));
  return {
    added: count("added"),
    changed: count("changed"),
    skipped: count("skipped"),
  };
};

/**
 * The student a row names and a grant in the period's unit: the Person the roster already
 * knows, or a new one with the row's name. A Person who is no longer active is none, so an
 * import never reopens a removed Person.
 */
const admitStudent = Effect.fn("roster.import.admit")(function* (
  actor: typeof TenantActor.Type,
  period: TenantPeriodsDoc,
  known: Option.Option<GenericId.GenericId<"tenantPeople">>,
  name: (typeof ImportRow.Type)["name"]
) {
  const person = yield* Option.match(known, {
    onNone: () => createPerson(actor, period.tenantId, name),
    onSome: (personId) =>
      Effect.flatMap(DatabaseReader, (reader) =>
        reader.table("tenantPeople").get(personId).pipe(Effect.orDie)
      ),
  });
  if (person.status !== "active") {
    return Option.none();
  }
  if (!(yield* studentOf(person._id, period.unitId))) {
    yield* assignRole(actor, person, "student", {
      kind: "unit",
      unitId: period.unitId,
    }).pipe(Effect.orDie);
  }
  return Option.some(person);
});

/**
 * Applies one row of a OneRoster import into a period (ADR 0029). The source's identity names
 * the student, never the email: a known identity places the student again, and a new one adds
 * a student with a grant in the period's unit and a roster row that keeps the blind. A student
 * who is no longer active is skipped.
 */
export const applySourcedRow = Effect.fn("roster.import.sourced")(function* (
  actor: typeof TenantActor.Type,
  period: TenantPeriodsDoc,
  keys: TenantKeys,
  row: typeof SourcedRow.Type
) {
  const known = yield* studentBySource(keys, period.tenantId, row.sourcedId);
  const person = yield* admitStudent(actor, period, known, row.name);
  if (Option.isNone(person)) {
    const skipped: RowOutcome = "skipped";
    return skipped;
  }
  if (Option.isNone(known)) {
    yield* writeSourcedId(keys, person.value, row.sourcedId);
    yield* personAuthority.record(actor, person.value, { type: "roster.set" });
  }
  if (row.cohortName !== undefined) {
    yield* placeNamed(actor, person.value, period, row.cohortName);
  }
  const outcome: RowOutcome = Option.isNone(known) ? "added" : "changed";
  return outcome;
});

/**
 * Applies one row of a Dapodik import into a period (ADR 0015). A NISN the roster holds
 * names the student: the import sets the under-age flag again and places the student. A new
 * NISN adds a student: a Person with the row's name, a student grant in the period's unit,
 * the roster row with the NISN sealed and blinded, and the placement. A student who is no
 * longer active is skipped, so an import never reopens a removed Person. The school's keys
 * come from the batch, which reads them once for all of its rows.
 */
export const applyRow = Effect.fn("roster.import.row")(function* (
  actor: typeof TenantActor.Type,
  period: TenantPeriodsDoc,
  keys: TenantKeys,
  row: typeof ImportRow.Type
) {
  const known = yield* studentByNisn(keys, period.tenantId, row.nisn);
  const person = yield* admitStudent(actor, period, known, row.name);
  if (Option.isNone(person)) {
    const skipped: RowOutcome = "skipped";
    return skipped;
  }
  yield* writeRosterEntry(keys, person.value, {
    nisn: Option.some(row.nisn),
    underAgeLimit: row.underAgeLimit,
  });
  yield* personAuthority.record(actor, person.value, { type: "roster.set" });
  if (row.cohortName !== undefined) {
    yield* placeNamed(actor, person.value, period, row.cohortName);
  }
  const outcome: RowOutcome = Option.isNone(known) ? "added" : "changed";
  return outcome;
});
