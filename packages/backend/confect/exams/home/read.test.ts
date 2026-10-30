import { beforeEach, describe, expect, it } from "@effect/vitest";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import { teacherExam } from "@repo/backend/test/exams";
import { homeOf, insertRoom, roomsOf } from "@repo/backend/test/home";
import { OPENS_AT, seedPlacement } from "@repo/backend/test/sittings";
import { TENANCY_NOW, tenancyFixture } from "@repo/backend/test/tenancy";
import { Array as Arr, Effect } from "effect";

/** One day, in milliseconds. */
const DAY = 86_400_000;

describe("exams home", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TENANCY_NOW);
  });

  it.effect(
    "shows a teacher the open rooms of the teacher's unit, and no other unit's",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const exam = yield* teacherExam(fixture, "PTS Biologi");
        yield* insertRoom(fixture, {
          examId: exam.id,
          opensAt: OPENS_AT,
          room: "Lab 2",
          state: "open",
        });
        yield* insertRoom(fixture, {
          examId: exam.id,
          opensAt: OPENS_AT,
          room: "Lab SMA",
          state: "open",
          unitId: fixture.units.sma,
        });

        const read = yield* homeOf(fixture, "teacher");

        expect(roomsOf(read.live)).toEqual(["Lab 2"]);
        expect(read.next).toEqual([]);
      })
  );

  it.effect("shows the owner the rooms of every unit of the school", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const exam = yield* teacherExam(fixture, "PTS");
      yield* insertRoom(fixture, {
        examId: exam.id,
        opensAt: OPENS_AT,
        room: "Lab 2",
        state: "open",
      });
      yield* insertRoom(fixture, {
        examId: exam.id,
        opensAt: OPENS_AT + 1,
        room: "Lab SMA",
        state: "open",
        unitId: fixture.units.sma,
      });

      const read = yield* homeOf(fixture, "owner");

      expect(roomsOf(read.live)).toEqual(["Lab 2", "Lab SMA"]);
    })
  );

  it.effect("shows the admin of the school the rooms of every unit", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const exam = yield* teacherExam(fixture, "PTS");
      yield* insertRoom(fixture, {
        examId: exam.id,
        opensAt: OPENS_AT,
        room: "Lab 2",
        state: "open",
      });

      const read = yield* homeOf(fixture, "admin");

      expect(roomsOf(read.live)).toEqual(["Lab 2"]);
    })
  );

  it.effect("shows a principal the rooms of the principal's own unit", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const exam = yield* teacherExam(fixture, "PTS");
      yield* insertRoom(fixture, {
        examId: exam.id,
        opensAt: OPENS_AT,
        room: "Lab 2",
        state: "open",
      });
      yield* insertRoom(fixture, {
        examId: exam.id,
        opensAt: OPENS_AT,
        room: "Lab SMA",
        state: "open",
        unitId: fixture.units.sma,
      });

      const read = yield* homeOf(fixture, "principal");

      expect(roomsOf(read.live)).toEqual(["Lab SMA"]);
    })
  );

  it.effect("shows a deputy the rooms of the unit the deputy covers", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const exam = yield* teacherExam(fixture, "PTS");
      yield* insertRoom(fixture, {
        examId: exam.id,
        opensAt: OPENS_AT,
        room: "Lab 2",
        state: "open",
      });

      const read = yield* homeOf(fixture, "deputy");

      expect(roomsOf(read.live)).toEqual(["Lab 2"]);
    })
  );

  it.effect(
    "gives a student nothing, even while a room of the student's unit is open",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const exam = yield* teacherExam(fixture, "PTS");
        yield* insertRoom(fixture, {
          examId: exam.id,
          opensAt: OPENS_AT,
          state: "open",
        });
        yield* insertRoom(fixture, {
          examId: exam.id,
          opensAt: TENANCY_NOW + DAY / 2,
          state: "scheduled",
        });
        yield* insertRoom(fixture, {
          examId: exam.id,
          opensAt: OPENS_AT - DAY,
          state: "closed",
        });

        const read = yield* homeOf(fixture, "student");

        expect(read).toEqual({ live: [], next: [] });
      })
  );

  it.effect(
    "lists the rooms that open within the next day, earliest first, and no other",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const exam = yield* teacherExam(fixture, "PTS");
        yield* insertRoom(fixture, {
          examId: exam.id,
          opensAt: TENANCY_NOW + DAY,
          room: "In a day",
          state: "scheduled",
        });
        yield* insertRoom(fixture, {
          examId: exam.id,
          opensAt: TENANCY_NOW + DAY / 2,
          room: "In twelve hours",
          state: "scheduled",
        });
        yield* insertRoom(fixture, {
          examId: exam.id,
          opensAt: TENANCY_NOW + DAY + 1,
          room: "In a day and a millisecond",
          state: "scheduled",
        });
        yield* insertRoom(fixture, {
          examId: exam.id,
          opensAt: TENANCY_NOW - 1,
          room: "Yesterday",
          state: "scheduled",
        });

        const read = yield* homeOf(fixture, "teacher");

        expect(roomsOf(read.next)).toEqual(["In twelve hours", "In a day"]);
        expect(read.live).toEqual([]);
      })
  );

  it.effect(
    "lists no open room whose closing time has passed, even while its state still reads open",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const exam = yield* teacherExam(fixture, "PTS");
        yield* insertRoom(fixture, {
          closesAt: TENANCY_NOW,
          examId: exam.id,
          opensAt: TENANCY_NOW - DAY,
          room: "Closed",
          state: "open",
        });

        const read = yield* homeOf(fixture, "teacher");

        expect(read.live).toEqual([]);
      })
  );

  it.effect("lists at most five rooms of a tile, the earliest ones", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const exam = yield* teacherExam(fixture, "PTS");
      yield* Effect.forEach(
        Arr.makeBy(7, (index) => index),
        (index) =>
          insertRoom(fixture, {
            examId: exam.id,
            opensAt: OPENS_AT + index,
            room: `Lab ${index}`,
            state: "open",
          }),
        { discard: true }
      );

      const read = yield* homeOf(fixture, "teacher");

      expect(roomsOf(read.live)).toEqual([
        "Lab 0",
        "Lab 1",
        "Lab 2",
        "Lab 3",
        "Lab 4",
      ]);
    })
  );

  it.effect("shows a cohort's room, with the time zone of its unit", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const exam = yield* teacherExam(fixture, "PTS");
      const cohortId = yield* seedPlacement(
        fixture,
        fixture.people.student.personId
      );
      yield* insertRoom(fixture, {
        cohortId,
        examId: exam.id,
        opensAt: OPENS_AT,
        room: "Ruang 10A",
        state: "open",
      });

      const read = yield* homeOf(fixture, "teacher");

      expect(read.live).toEqual([
        expect.objectContaining({
          cohortId,
          room: "Ruang 10A",
          timeZone: "Asia/Jakarta",
        }),
      ]);
    })
  );

  it.effect("shows each room in the time zone its unit keeps now", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const exam = yield* teacherExam(fixture, "PTS");
      yield* fixture.run(
        Effect.flatMap(DatabaseWriter, (writer) =>
          writer
            .table("tenantUnits")
            .patch(fixture.units.smp, { timeZone: "Europe/Berlin" })
        ).pipe(Effect.orDie)
      );
      yield* insertRoom(fixture, {
        examId: exam.id,
        opensAt: TENANCY_NOW + DAY / 2,
        state: "scheduled",
      });

      const read = yield* homeOf(fixture, "teacher");

      expect(read.next).toEqual([
        expect.objectContaining({ timeZone: "Europe/Berlin" }),
      ]);
    })
  );

  it.effect("reads no room of another school", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const foreign = yield* fixture.run(
        Effect.flatMap(DatabaseWriter, (writer) =>
          writer.table("exams").insert({
            createdAt: TENANCY_NOW,
            createdBy: fixture.users.otherOwner.userId,
            questions: [],
            scope: { kind: "tenant" },
            tenantId: fixture.tenants.other,
            title: "Ujian sekolah lain",
          })
        ).pipe(Effect.orDie)
      );
      yield* insertRoom(fixture, {
        examId: foreign,
        opensAt: OPENS_AT,
        room: "Foreign",
        state: "open",
        tenantId: fixture.tenants.other,
        unitId: fixture.units.sd,
      });

      const read = yield* homeOf(fixture, "owner");

      expect(read.live).toEqual([]);
    })
  );
});
