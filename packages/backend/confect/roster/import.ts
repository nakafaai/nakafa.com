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
  writeRosterEntry,
} from "@repo/backend/confect/roster/entry";
import type { ImportRow } from "@repo/backend/confect/roster/schema";
import {
  personAuthority,
  placementOf,
  studentOf,
} from "@repo/backend/confect/tenancy/authority";
import { cohortNameKey } from "@repo/backend/confect/tenancy/cohort";
import { createPerson } from "@repo/backend/confect/tenancy/create";
import { Effect, Option } from "effect";

/** What applying one row did: a new student, a changed one, or a row it skipped. */
type RowOutcome = "added" | "changed" | "skipped";

/** The student whose roster row holds this NISN in the school, if any. */
const studentByNisn = Effect.fn("roster.import.byNisn")(function* (
  tenantId: GenericId.GenericId<"tenants">,
  nisn: (typeof ImportRow.Type)["nisn"]
) {
  const blind = yield* blindNisn(tenantId, nisn);
  const entry = yield* (yield* DatabaseReader)
    .table("rosterEntries")
    .index("by_tenantId_and_nisn_blind", (query) =>
      query.eq("tenantId", tenantId).eq("nisn.blind", blind)
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

/**
 * Applies one row of a Dapodik import into a period (ADR 0015). A NISN the roster holds
 * names the student: the import sets the under-age flag again and places the student. A new
 * NISN adds a student: a Person with the row's name, a student grant in the period's unit,
 * the roster row with the NISN sealed and blinded, and the placement. A student who is no
 * longer active is skipped, so an import never reopens a removed Person.
 */
export const applyRow = Effect.fn("roster.import.row")(function* (
  actor: typeof TenantActor.Type,
  period: TenantPeriodsDoc,
  row: typeof ImportRow.Type
) {
  const known = yield* studentByNisn(period.tenantId, row.nisn);
  const person = yield* Option.match(known, {
    onNone: () => createPerson(actor, period.tenantId, row.name),
    onSome: (personId) =>
      Effect.flatMap(DatabaseReader, (reader) =>
        reader.table("tenantPeople").get(personId).pipe(Effect.orDie)
      ),
  });
  if (person.status !== "active") {
    const skipped: RowOutcome = "skipped";
    return skipped;
  }
  if (!(yield* studentOf(person._id, period.unitId))) {
    yield* assignRole(actor, person, "student", {
      kind: "unit",
      unitId: period.unitId,
    }).pipe(Effect.orDie);
  }
  yield* writeRosterEntry(person, {
    nisn: Option.some(row.nisn),
    underAgeLimit: row.underAgeLimit,
  });
  yield* personAuthority.record(actor, person, { type: "roster.set" });
  if (row.cohortName !== undefined) {
    yield* placeNamed(actor, person, period, row.cohortName);
  }
  const outcome: RowOutcome = Option.isNone(known) ? "added" : "changed";
  return outcome;
});
