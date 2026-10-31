import { beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { denied, nf } from "@repo/backend/test/classroom";
import { asStaffSchool, NISN, setRoster } from "@repo/backend/test/guardians";
import {
  journal,
  slugOf,
  TENANCY_NOW,
  tenancyFixture,
} from "@repo/backend/test/tenancy";
import { Array as Arr, Effect, Option } from "effect";

const { get, set } = refs.public.roster.entries;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(TENANCY_NOW);
});

/** The stored roster row of the school's student. */
const storedRow = Effect.flatMap(DatabaseReader, (reader) =>
  reader.table("rosterEntries").index("by_creation_time").first()
);

describe("roster/entries", () => {
  it.effect(
    "keeps a NISN sealed and blinded, never shows it back, and journals no value",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* asStaffSchool(fixture);
        const view = yield* setRoster(fixture, NISN);
        expect(view).toEqual({
          hasNisn: true,
          personId: fixture.people.student.personId,
        });
        const row = yield* fixture.run(storedRow);
        const nisn = Option.getOrUndefined(row)?.nisn;
        expect(nisn?.blind).toEqual(expect.any(String));
        expect(nisn?.blind).not.toContain(NISN);
        expect(nisn?.sealed).toBeInstanceOf(ArrayBuffer);
        const entry = Arr.last(yield* fixture.run(journal));
        expect(entry).toMatchObject({
          _tag: "Some",
          value: { change: { type: "roster.set" } },
        });
        expect(
          yield* fixture.as("admin").query(get, {
            personId: fixture.people.student.personId,
            slug: nf,
          })
        ).toEqual(view);
      })
  );

  it.effect("reads a student without a row as having no NISN", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      yield* asStaffSchool(fixture);
      expect(
        yield* fixture.as("admin").query(get, {
          personId: fixture.people.student.personId,
          slug: nf,
        })
      ).toEqual({ hasNisn: false, personId: fixture.people.student.personId });
    })
  );

  it.effect("refuses the roster to every other role and school", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      yield* asStaffSchool(fixture);
      for (const account of ["teacher", "student"] as const) {
        expect(
          yield* Effect.flip(
            fixture.as(account).mutation(set, {
              nisn: NISN,
              personId: fixture.people.student.personId,
              slug: nf,
            })
          )
        ).toMatchObject(denied("role"));
        expect(
          yield* Effect.flip(
            fixture.as(account).query(get, {
              personId: fixture.people.student.personId,
              slug: nf,
            })
          )
        ).toMatchObject(denied("role"));
      }
      expect(
        yield* Effect.flip(
          fixture.as("otherOwner").mutation(set, {
            nisn: NISN,
            personId: fixture.people.student.personId,
            slug: slugOf("other"),
          })
        )
      ).toMatchObject(denied("resource"));
    })
  );
});
