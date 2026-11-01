import type { GenericId } from "@confect/core";
import { beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { partsOf } from "@repo/backend/confect/notifications/detail";
import { isSchoolRow } from "@repo/backend/confect/notifications/schema";
import { IBU } from "@repo/backend/test/guardians";
import {
  keyedExam,
  keyedSchool,
  scheduleSitting,
  seedPlacement,
  sittingRow,
} from "@repo/backend/test/sittings";
import { TENANCY_NOW, tenancyFixture } from "@repo/backend/test/tenancy";
import { Array as Arr, Effect } from "effect";

type Fixture = Effect.Success<typeof tenancyFixture>;

const { run } = refs.internal.notifications.sittings;

/** When the test sitting opens: two days ahead, so the notice runs that its schedule makes wait and the tests drive them. */
const OPENS_AT = TENANCY_NOW + 2 * 24 * 60 * 60 * 1000;

/** When the test sitting closes, an hour after it opens. */
const CLOSES_AT = OPENS_AT + 60 * 60 * 1000;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(TENANCY_NOW);
});

/** The inbox rows that one Person holds. */
const rowsOf = (
  fixture: Fixture,
  personId: GenericId.GenericId<"tenantPeople">
) =>
  fixture.run(
    Effect.flatMap(DatabaseReader, (reader) =>
      reader
        .table("notifications")
        .index("by_recipientPersonId_and_createdAt", (query) =>
          query.eq("recipientPersonId", personId)
        )
        .take(10)
        .pipe(Effect.orDie)
    )
  );

/** A cohort sitting of a keyed exam, which expects the fixture's student, scheduled by its teacher. */
const cohortSitting = Effect.fn("test.notifications.sitting")(function* (
  fixture: Fixture
) {
  yield* keyedSchool(fixture);
  const examId = yield* keyedExam(fixture, "Ujian Fisika");
  const cohortId = yield* seedPlacement(
    fixture,
    fixture.people.student.personId
  );
  return yield* scheduleSitting(fixture, {
    closesAt: CLOSES_AT,
    examId,
    group: { cohortId, kind: "cohort" },
    opensAt: OPENS_AT,
  });
});

/** A guardian Person of the school, in the given state, with a verified link to the fixture's student. */
const verifiedGuardian = (fixture: Fixture, status: "active" | "removed") =>
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

describe("notifications/sittings", () => {
  it.effect(
    "schedules a sitting's notices with it, and writes the start row of each expected student with the sitting it opens",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const made = yield* cohortSitting(fixture);
        // The opening, the closing, the students' start and the guardians' reminder.
        expect((yield* sittingRow(fixture, made.id)).jobs).toHaveLength(4);
        yield* fixture.internal.mutation(run, {
          cursor: null,
          notice: "examStart",
          sittingId: made.id,
        });
        const rows = yield* rowsOf(fixture, fixture.people.student.personId);
        expect(rows).toMatchObject([
          {
            changeType: "exam.starting",
            sittingId: made.id,
            subject: { id: made.id, kind: "sitting" },
          },
        ]);
        const parts = yield* fixture.run(
          Effect.gen(function* () {
            const reader = yield* DatabaseReader;
            const person = yield* reader
              .table("tenantPeople")
              .get(fixture.people.student.personId);
            const tenant = yield* reader
              .table("tenants")
              .get(fixture.tenants.nf);
            return yield* partsOf(
              Arr.getUnsafe(Arr.filter(rows, isSchoolRow), 0),
              person,
              tenant
            );
          }).pipe(Effect.orDie)
        );
        expect(parts).toEqual({
          detail: null,
          exam: {
            examTitle: "Ujian Fisika",
            opensAt: OPENS_AT,
            room: "Lab 2",
            sittingId: made.id,
            student: null,
          },
          grade: null,
          missed: null,
        });
        // Once the sitting closes, its row shows no sitting.
        yield* fixture.run(
          Effect.flatMap(DatabaseWriter, (writer) =>
            writer.table("examSittings").patch(made.id, { state: "closed" })
          ).pipe(Effect.orDie)
        );
        const closed = yield* fixture.run(
          Effect.gen(function* () {
            const reader = yield* DatabaseReader;
            const person = yield* reader
              .table("tenantPeople")
              .get(fixture.people.student.personId);
            const tenant = yield* reader
              .table("tenants")
              .get(fixture.tenants.nf);
            return yield* partsOf(
              Arr.getUnsafe(Arr.filter(rows, isSchoolRow), 0),
              person,
              tenant
            );
          }).pipe(Effect.orDie)
        );
        expect(closed.exam).toBeNull();
      })
  );

  it.effect(
    "writes a page of start rows per run and schedules the next page for a large sitting",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const made = yield* cohortSitting(fixture);
        const sitting = yield* sittingRow(fixture, made.id);
        yield* fixture.run(
          Effect.gen(function* () {
            const reader = yield* DatabaseReader;
            const writer = yield* DatabaseWriter;
            const cohortId = sitting.cohortId;
            if (cohortId === null) {
              return yield* Effect.die("the test sitting is of a cohort");
            }
            const cohort = yield* reader.table("tenantCohorts").get(cohortId);
            yield* Effect.forEach(Arr.range(1, 100), (index) =>
              Effect.gen(function* () {
                const personId = yield* writer.table("tenantPeople").insert({
                  account: { state: "unclaimed" },
                  kind: "member",
                  name: `Siswa ${index}`,
                  status: "active",
                  tenantId: fixture.tenants.nf,
                });
                yield* writer.table("tenantCohortMembers").insert({
                  cohortId,
                  periodId: cohort.periodId,
                  personId,
                  tenantId: fixture.tenants.nf,
                });
              })
            );
          }).pipe(Effect.orDie)
        );
        yield* fixture.internal.mutation(run, {
          cursor: null,
          notice: "examStart",
          sittingId: made.id,
        });
        const written = yield* fixture.run(
          Effect.flatMap(DatabaseReader, (reader) =>
            reader.table("notifications").index("by_creation_time").take(200)
          ).pipe(Effect.orDie)
        );
        expect(written.length).toBeGreaterThanOrEqual(100);
      })
  );

  it.effect(
    "writes the reminder of each verified guardian of an expected student, naming the child",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const made = yield* cohortSitting(fixture);
        const guardianPersonId = yield* verifiedGuardian(fixture, "active");
        const removedGuardian = yield* verifiedGuardian(fixture, "removed");
        yield* fixture.internal.mutation(run, {
          cursor: null,
          notice: "examGuardianReminder",
          sittingId: made.id,
        });
        // A guardian who left the school gets no reminder.
        expect(yield* rowsOf(fixture, removedGuardian)).toEqual([]);
        const rows = yield* rowsOf(fixture, guardianPersonId);
        expect(rows).toMatchObject([
          {
            changeType: "exam.reminder",
            sittingId: made.id,
            studentPersonId: fixture.people.student.personId,
          },
        ]);
        const parts = yield* fixture.run(
          Effect.gen(function* () {
            const reader = yield* DatabaseReader;
            const person = yield* reader
              .table("tenantPeople")
              .get(guardianPersonId);
            const tenant = yield* reader
              .table("tenants")
              .get(fixture.tenants.nf);
            return yield* partsOf(
              Arr.getUnsafe(Arr.filter(rows, isSchoolRow), 0),
              person,
              tenant
            );
          }).pipe(Effect.orDie)
        );
        expect(parts.exam?.student).toEqual(expect.any(String));
        expect(yield* rowsOf(fixture, fixture.people.student.personId)).toEqual(
          []
        );
      })
  );

  it.effect(
    "sends nothing for a sitting that has opened, and none for one that is gone",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const made = yield* cohortSitting(fixture);
        vi.setSystemTime(OPENS_AT);
        yield* fixture.internal.mutation(
          refs.internal.exams.sittings.timers.open,
          { sittingId: made.id }
        );
        yield* fixture.internal.mutation(run, {
          cursor: null,
          notice: "examStart",
          sittingId: made.id,
        });
        expect(yield* rowsOf(fixture, fixture.people.student.personId)).toEqual(
          []
        );
        yield* fixture.run(
          Effect.flatMap(DatabaseWriter, (writer) =>
            writer.table("examSittings").delete(made.id)
          ).pipe(Effect.orDie)
        );
        yield* fixture.internal.mutation(run, {
          cursor: null,
          notice: "examStart",
          sittingId: made.id,
        });
        expect(yield* rowsOf(fixture, fixture.people.student.personId)).toEqual(
          []
        );
      })
  );
});
