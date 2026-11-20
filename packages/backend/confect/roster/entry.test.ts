import { describe, expect, it } from "@effect/vitest";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import {
  blindSourcedId,
  openNisn,
  rosterEntryOf,
  schoolKeys,
  writeRosterEntry,
  writeSourcedId,
} from "@repo/backend/confect/roster/entry";
import { Nisn } from "@repo/backend/confect/roster/schema";
import { keyedFixture } from "@repo/backend/test/classroom";
import type { tenancyFixture } from "@repo/backend/test/tenancy";
import { Effect, Option, Schema } from "effect";

const NISN = Schema.decodeSync(Nisn)("0012345678");

/** A new active student of the school `nf`, with no roster row yet. */
const student = (
  tenantId: Effect.Success<typeof tenancyFixture>["tenants"]["nf"]
) =>
  Effect.gen(function* () {
    const personId = yield* (yield* DatabaseWriter)
      .table("tenantPeople")
      .insert({
        account: { state: "unclaimed" },
        kind: "member",
        name: "Raka Pratama",
        status: "active",
        tenantId,
      })
      .pipe(Effect.orDie);
    return yield* (yield* DatabaseReader)
      .table("tenantPeople")
      .get(personId)
      .pipe(Effect.orDie);
  });

describe("roster/entry", () => {
  it.effect(
    "names a student's roster row by a file's identity, keeping the NISN the school wrote",
    () =>
      Effect.gen(function* () {
        const fixture = yield* keyedFixture;
        const { entry, nisn, sourced } = yield* fixture.run(
          Effect.gen(function* () {
            const keys = yield* schoolKeys(fixture.tenants.nf);
            const person = yield* student(fixture.tenants.nf);
            yield* writeRosterEntry(keys, person, NISN);
            yield* writeSourcedId(keys, person, "user-1");
            const row = Option.getOrThrow(yield* rosterEntryOf(person._id));
            return {
              entry: row,
              nisn: yield* openNisn(keys, row),
              sourced: yield* blindSourcedId(keys, "user-1"),
            };
          })
        );
        expect(entry.sourcedId).toBe(sourced);
        expect(nisn).toEqual(Option.some(NISN));
      })
  );

  it.effect("opens no NISN for a row that a file's identity alone wrote", () =>
    Effect.gen(function* () {
      const fixture = yield* keyedFixture;
      const nisn = yield* fixture.run(
        Effect.gen(function* () {
          const keys = yield* schoolKeys(fixture.tenants.nf);
          const person = yield* student(fixture.tenants.nf);
          yield* writeSourcedId(keys, person, "user-2");
          const row = Option.getOrThrow(yield* rosterEntryOf(person._id));
          return yield* openNisn(keys, row);
        })
      );
      expect(nisn).toEqual(Option.none());
    })
  );
});
