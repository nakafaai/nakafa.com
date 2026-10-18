import { beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { Email } from "@repo/backend/confect/tenancy/schema";
import { nf } from "@repo/backend/test/editor";
import { archiveUnit } from "@repo/backend/test/exams";
import { keyedSchool, sittingRow } from "@repo/backend/test/sittings";
import {
  defectOf,
  slugOf,
  TENANCY_NOW,
  tenancyFixture,
} from "@repo/backend/test/tenancy";
import { Array as Arr, Effect, Exit, Schema } from "effect";

const seed = refs.internal.exams.seed.sitting;
const { mine } = refs.public.exams.sittings;

/** An address in the test's own format, decoded as the seed takes it. */
const addressOf = Schema.decodeSync(Email);

describe("exams seed sitting", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TENANCY_NOW);
  });

  it.effect(
    "gives the learner a student grant in the first active unit, and opens a sitting of two keyed questions",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* keyedSchool(fixture);
        const user = yield* fixture.run(
          Effect.flatMap(DatabaseReader, (reader) =>
            reader
              .table("users")
              .get(fixture.users.student.userId)
              .pipe(Effect.orDie)
          )
        );
        const made = yield* fixture.internal.mutation(seed, {
          email: addressOf(user.email),
          slug: nf,
        });
        const sitting = yield* sittingRow(fixture, made.sittingId);
        expect(sitting).toMatchObject({ cohortId: null, state: "open" });
        expect([
          fixture.units.sd,
          fixture.units.sma,
          fixture.units.smp,
        ]).toContain(sitting.unitId);
        expect(sitting.closesAt - sitting.opensAt).toBe(60 * 60 * 1000);
        const exam = yield* fixture.run(
          Effect.flatMap(DatabaseReader, (reader) =>
            reader.table("exams").get(made.examId).pipe(Effect.orDie)
          )
        );
        expect(exam).toMatchObject({ title: "Ujian Acceptance" });
        expect(exam.questions).toHaveLength(2);
        const listed = yield* fixture.as("student").query(mine, { slug: nf });
        expect(Arr.map(listed, (row) => row.id)).toContain(made.sittingId);
      })
  );

  it.effect("refuses a school that no slug names", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const exit = yield* Effect.exit(
        fixture.internal.mutation(seed, {
          email: addressOf("nobody@example.test"),
          slug: slugOf("tidak-ada"),
        })
      );
      expect(Exit.isFailure(exit)).toBe(true);
      expect(defectOf(exit)).toContain("No school has this slug.");
    })
  );

  it.effect("refuses an address that no account holds", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const exit = yield* Effect.exit(
        fixture.internal.mutation(seed, {
          email: addressOf("tidak-ada@example.test"),
          slug: nf,
        })
      );
      expect(defectOf(exit)).toContain("No account holds this address.");
    })
  );

  it.effect(
    "refuses an address whose account has no person in the school",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* fixture.account("outsider", "outsider@example.test", true);
        const exit = yield* Effect.exit(
          fixture.internal.mutation(seed, {
            email: addressOf("outsider@example.test"),
            slug: nf,
          })
        );
        expect(defectOf(exit)).toContain(
          "This address is not a member of the school."
        );
      })
  );

  it.effect(
    "refuses an operator's account, which holds only visit grants",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const user = yield* fixture.run(
          Effect.flatMap(DatabaseReader, (reader) =>
            reader
              .table("users")
              .get(fixture.users.visitor.userId)
              .pipe(Effect.orDie)
          )
        );
        const exit = yield* Effect.exit(
          fixture.internal.mutation(seed, {
            email: addressOf(user.email),
            slug: nf,
          })
        );
        expect(defectOf(exit)).toContain(
          "Operators hold only temporary visit grants."
        );
      })
  );

  it.effect("refuses a school with no active unit", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const user = yield* fixture.run(
        Effect.flatMap(DatabaseReader, (reader) =>
          reader
            .table("users")
            .get(fixture.users.student.userId)
            .pipe(Effect.orDie)
        )
      );
      yield* fixture.run(archiveUnit(fixture.units.sd));
      yield* fixture.run(archiveUnit(fixture.units.sma));
      yield* fixture.run(archiveUnit(fixture.units.smp));
      const exit = yield* Effect.exit(
        fixture.internal.mutation(seed, {
          email: addressOf(user.email),
          slug: nf,
        })
      );
      expect(defectOf(exit)).toContain("The school has no active unit.");
    })
  );

  it.effect("refuses a school whose Owner has not signed in", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const user = yield* fixture.run(
        Effect.flatMap(DatabaseReader, (reader) =>
          reader
            .table("users")
            .get(fixture.users.student.userId)
            .pipe(Effect.orDie)
        )
      );
      yield* fixture.run(
        Effect.flatMap(DatabaseWriter, (writer) =>
          writer
            .table("tenantPeople")
            .patch(fixture.people.owner.personId, {
              account: { state: "unclaimed" },
            })
            .pipe(Effect.orDie)
        )
      );
      const exit = yield* Effect.exit(
        fixture.internal.mutation(seed, {
          email: addressOf(user.email),
          slug: nf,
        })
      );
      expect(defectOf(exit)).toContain("The school's Owner has not signed in.");
    })
  );
});
