import type { GenericId } from "@confect/core";
import type {
  RosterEntriesDoc,
  TenantPeopleDoc,
} from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import {
  Nisn,
  type RosterView,
  type rosterEntryValidator,
} from "@repo/backend/confect/roster/schema";
import {
  readTenantKeys,
  type TenantKeys,
} from "@repo/backend/confect/vault/keys";
import {
  blindText,
  openText,
  sealText,
} from "@repo/backend/confect/vault/text";
import { Effect, Option, Schema } from "effect";

/**
 * The field a NISN is blinded in. The blind names no row, so one NISN blinds the
 * same for every student of the school, and an import or a guardian's check finds
 * it by its blind alone.
 */
const NISN_BLIND = { field: "nisn", table: "rosterEntries" };

/**
 * The keys of a student's school. A school without keys is a defect in its data (ADR 0030).
 * Deriving them is the costly part of every NISN step, so each function reads them once and
 * hands them to every blind, seal, and open it makes.
 */
export const schoolKeys = (tenantId: GenericId.GenericId<"tenants">) =>
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
  keys: TenantKeys,
  nisn: typeof Nisn.Type
) {
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
  keys: TenantKeys,
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
        const sealed = yield* sealText(
          keys,
          { ...NISN_BLIND, row: [person._id] },
          value
        );
        const blind = yield* blindText(keys, NISN_BLIND, value);
        return { blind, sealed };
      }).pipe(Effect.orDie),
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

/**
 * The NISN a roster row holds, opened under the school key for the school's own export.
 * A sealed NISN that does not open is a defect in the school's data (ADR 0030).
 */
export const openNisn = Effect.fn("roster.entry.open")(function* (
  keys: TenantKeys,
  entry: RosterEntriesDoc
) {
  if (entry.nisn === undefined) {
    return Option.none<typeof Nisn.Type>();
  }
  const text = yield* openText(
    keys,
    { ...NISN_BLIND, row: [entry.personId] },
    entry.nisn.sealed
  );
  return Option.some(yield* Schema.decodeEffect(Nisn)(text));
}, Effect.orDie);
