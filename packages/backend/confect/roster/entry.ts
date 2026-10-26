import type { GenericId } from "@confect/core";
import type {
  RosterEntriesDoc,
  TenantPeopleDoc,
} from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import type {
  Nisn,
  RosterView,
  rosterEntryValidator,
} from "@repo/backend/confect/roster/schema";
import { readTenantKeys } from "@repo/backend/confect/vault/keys";
import { blindText, sealText } from "@repo/backend/confect/vault/text";
import { Effect, Option } from "effect";

/**
 * The field a NISN is blinded in. The blind names no row, so one NISN blinds the
 * same for every student of the school, and an import or a guardian's check finds
 * it by its blind alone.
 */
const NISN_BLIND = { field: "nisn", table: "rosterEntries" };

/** The keys of a student's school. A school without keys is a defect in its data (ADR 0030). */
const schoolKeys = (tenantId: GenericId.GenericId<"tenants">) =>
  readTenantKeys(tenantId).pipe(Effect.orDie);

/** The roster row of one student, if the school wrote one. */
export const rosterEntryOf = Effect.fn("roster.entry.of")(function* (
  personId: GenericId.GenericId<"tenantPeople">
) {
  return yield* (yield* DatabaseReader)
    .table("rosterEntries")
    .get("by_personId", personId)
    .pipe(
      Effect.asSome,
      Effect.catchTag("GetByIndexFailure", () => Effect.succeedNone),
      Effect.orDie
    );
});

/**
 * Whether a student counts as under the age limit. A student without a roster row
 * or without the flag counts as under it, so the consent gate errs toward consent
 * (ADR 0034).
 */
export const countsUnderAge = (
  entry: Option.Option<Pick<RosterEntriesDoc, "underAgeLimit">>
) => Option.getOrUndefined(entry)?.underAgeLimit !== false;

/** The blind of a NISN under the school key, which a stored row is compared by. */
export const blindNisn = Effect.fn("roster.entry.blind")(function* (
  tenantId: GenericId.GenericId<"tenants">,
  nisn: typeof Nisn.Type
) {
  const keys = yield* schoolKeys(tenantId);
  return yield* blindText(keys, NISN_BLIND, nisn).pipe(Effect.orDie);
});

/** The view of a roster row that staff read: whether a NISN is on file, and the age flag. */
export const rosterViewOf = (
  personId: GenericId.GenericId<"tenantPeople">,
  entry: Option.Option<RosterEntriesDoc>
): typeof RosterView.Type => {
  const row = Option.getOrUndefined(entry);
  return {
    hasNisn: row?.nisn !== undefined,
    personId,
    ...(row?.underAgeLimit === undefined
      ? {}
      : { underAgeLimit: row.underAgeLimit }),
  };
};

/**
 * Writes the roster row of one student: the NISN, sealed and blinded under the
 * school key, when one is given, and the age flag. A NISN that is not given keeps
 * the one on file, so setting the flag alone never drops it.
 */
export const writeRosterEntry = Effect.fn("roster.entry.write")(function* (
  person: TenantPeopleDoc,
  facts: {
    readonly nisn: Option.Option<typeof Nisn.Type>;
    readonly underAgeLimit: boolean;
  }
) {
  const existing = yield* rosterEntryOf(person._id);
  const nisn = yield* Option.match(facts.nisn, {
    onNone: () => Effect.succeed(Option.getOrUndefined(existing)?.nisn),
    onSome: (value) =>
      Effect.gen(function* () {
        const keys = yield* schoolKeys(person.tenantId);
        const sealed = yield* sealText(
          keys,
          { ...NISN_BLIND, row: [person._id] },
          value
        ).pipe(Effect.orDie);
        const blind = yield* blindText(keys, NISN_BLIND, value).pipe(
          Effect.orDie
        );
        return { blind, sealed };
      }),
  });
  const row: typeof rosterEntryValidator.Type = {
    ...(nisn === undefined ? {} : { nisn }),
    personId: person._id,
    tenantId: person.tenantId,
    underAgeLimit: facts.underAgeLimit,
  };
  const writer = yield* DatabaseWriter;
  yield* Option.match(existing, {
    onNone: () => writer.table("rosterEntries").insert(row),
    onSome: (entry) =>
      writer
        .table("rosterEntries")
        .replace(entry._id, row)
        .pipe(Effect.as(entry._id)),
  }).pipe(Effect.orDie);
  return row;
});
