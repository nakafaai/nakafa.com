import type { GenericId } from "@confect/core";
import { describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { partsOf } from "@repo/backend/confect/notifications/detail";
import {
  classOf,
  cohort,
  nf,
  period,
  teach,
} from "@repo/backend/test/classroom";
import { IBU } from "@repo/backend/test/guardians";
import { TENANCY_NOW, tenancyFixture } from "@repo/backend/test/tenancy";
import { Array as Arr, Effect } from "effect";

type Fixture = Effect.Success<typeof tenancyFixture>;

const { enter, release } = refs.public.records.grades;

/** A class of the SMP unit with its subject teacher, and the school's student placed in its cohort. */
const setup = Effect.fn("test.notifications.grades.setup")(function* (
  fixture: Fixture
) {
  const term = yield* period(fixture, fixture.units.smp);
  const x1 = yield* cohort(fixture, term.id, "X-1");
  const fisika = yield* classOf(fixture, x1.id, "Fisika");
  yield* teach(fixture, fisika.id, fixture.people.teacher.personId);
  yield* fixture.as("admin").mutation(refs.public.tenancy.placements.place, {
    cohortId: x1.id,
    personId: fixture.people.student.personId,
    slug: nf,
  });
  return fisika.id;
});

/** A guardian Person of the school, in the given state, with a verified link to the school's student. */
const guardianOf = (fixture: Fixture, status: "active" | "removed") =>
  fixture.run(
    Effect.gen(function* () {
      const writer = yield* DatabaseWriter;
      const guardianPersonId = yield* writer.table("tenantPeople").insert({
        account: { state: "unclaimed" },
        kind: "member",
        name: "Ibu Raka",
        status,
        tenantId: fixture.tenants.nf,
      });
      yield* writer.table("guardianLinks").insert({
        email: IBU,
        expiresAt: TENANCY_NOW + 1,
        guardianPersonId,
        mismatches: 0,
        startedBy: fixture.people.admin.personId,
        state: { at: TENANCY_NOW, status: "verified" },
        studentPersonId: fixture.people.student.personId,
        tenantId: fixture.tenants.nf,
      });
      return guardianPersonId;
    }).pipe(Effect.orDie)
  );

/** The rows one Person holds, each with what it shows of its grade. */
const gradesShownTo = (
  fixture: Fixture,
  personId: GenericId.GenericId<"tenantPeople">
) =>
  fixture.run(
    Effect.gen(function* () {
      const reader = yield* DatabaseReader;
      const person = yield* reader.table("tenantPeople").get(personId);
      const tenant = yield* reader.table("tenants").get(fixture.tenants.nf);
      const rows = yield* reader
        .table("notifications")
        .index("by_recipientPersonId_and_createdAt", (query) =>
          query.eq("recipientPersonId", personId)
        )
        .take(10);
      return yield* Effect.forEach(rows, (row) =>
        Effect.map(partsOf(row, person, tenant), (parts) => ({
          changeType: row.changeType,
          grade: parts.grade,
        }))
      );
    }).pipe(Effect.orDie)
  );

describe("notifications/grades", () => {
  it.effect(
    "tells the student and each active verified guardian of a released grade, once, and shows none once it is a draft again",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const classId = yield* setup(fixture);
        const guardian = yield* guardianOf(fixture, "active");
        const removed = yield* guardianOf(fixture, "removed");
        const entered = yield* fixture.as("teacher").mutation(enter, {
          classId,
          personId: fixture.people.student.personId,
          slug: nf,
          value: 80,
        });
        // A draft tells no one.
        expect(
          yield* gradesShownTo(fixture, fixture.people.student.personId)
        ).toEqual([]);
        yield* fixture
          .as("teacher")
          .mutation(release, { gradeId: entered.id, slug: nf });
        // A repeated release tells no one again.
        yield* fixture
          .as("teacher")
          .mutation(release, { gradeId: entered.id, slug: nf });
        expect(
          yield* gradesShownTo(fixture, fixture.people.student.personId)
        ).toEqual([
          {
            changeType: "grade.released",
            grade: { className: expect.any(String), student: null },
          },
        ]);
        const toGuardian = yield* gradesShownTo(fixture, guardian);
        expect(toGuardian).toEqual([
          {
            changeType: "grade.released",
            grade: {
              className: expect.any(String),
              student: expect.any(String),
            },
          },
        ]);
        expect(yield* gradesShownTo(fixture, removed)).toEqual([]);
        yield* fixture.run(
          Effect.flatMap(DatabaseWriter, (writer) =>
            writer.table("classGrades").patch(entered.id, { state: "draft" })
          ).pipe(Effect.orDie)
        );
        expect(
          Arr.map(
            yield* gradesShownTo(fixture, guardian),
            (shown) => shown.grade
          )
        ).toEqual([null]);
      })
  );
});
