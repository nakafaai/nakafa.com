import { beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import type { ExamSummary } from "@repo/backend/confect/exams/exam";
import { nf } from "@repo/backend/test/editor";
import { archiveUnit, LANGUAGE, teacherExam } from "@repo/backend/test/exams";
import { homeOf, insertRoom, roomsOf } from "@repo/backend/test/home";
import { OPENS_AT, seedPlacement } from "@repo/backend/test/sittings";
import { TENANCY_NOW, tenancyFixture } from "@repo/backend/test/tenancy";
import { Array as Arr, Effect } from "effect";

const { create } = refs.public.exams.exams;

/** One day, in milliseconds. */
const DAY = 86_400_000;

/** The titles of a list of exams, in order. */
const titlesOf = (exams: readonly (typeof ExamSummary.Type)[]) =>
  Arr.map(exams, (exam) => exam.title);

describe("exams home", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TENANCY_NOW);
  });

  it.effect(
    "shows a teacher the open rooms of the teacher's unit, and the teacher's own drafts",
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
        expect(titlesOf(read.drafts)).toEqual(["PTS Biologi"]);
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
      expect(read.drafts).toEqual([]);
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

  it.effect(
    "shows a principal the rooms of the principal's own unit, and no drafts",
    () =>
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
        expect(read.drafts).toEqual([]);
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
          opensAt: TENANCY_NOW + 2 * DAY,
          state: "scheduled",
        });
        yield* insertRoom(fixture, {
          examId: exam.id,
          opensAt: OPENS_AT - DAY,
          state: "closed",
        });

        const read = yield* homeOf(fixture, "student");

        expect(read).toEqual({
          canManageSetup: false,
          closed: [],
          drafts: [],
          live: [],
          next: [],
        });
      })
  );

  it.effect(
    "tells the owner that the viewer may manage the school's setup, and a student that it may not",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;

        const owner = yield* homeOf(fixture, "owner");
        const student = yield* homeOf(fixture, "student");

        expect(owner.canManageSetup).toBe(true);
        expect(student.canManageSetup).toBe(false);
      })
  );

  it.effect(
    "lists the rooms that open within fourteen days, earliest first, and no other",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const exam = yield* teacherExam(fixture, "PTS");
        yield* insertRoom(fixture, {
          examId: exam.id,
          opensAt: TENANCY_NOW + 14 * DAY,
          room: "Day 14",
          state: "scheduled",
        });
        yield* insertRoom(fixture, {
          examId: exam.id,
          opensAt: TENANCY_NOW + DAY,
          room: "Day 1",
          state: "scheduled",
        });
        yield* insertRoom(fixture, {
          examId: exam.id,
          opensAt: TENANCY_NOW + 14 * DAY + 1,
          room: "Day 14 and a millisecond",
          state: "scheduled",
        });
        yield* insertRoom(fixture, {
          examId: exam.id,
          opensAt: TENANCY_NOW - 1,
          room: "Yesterday",
          state: "scheduled",
        });

        const read = yield* homeOf(fixture, "teacher");

        expect(roomsOf(read.next)).toEqual(["Day 1", "Day 14"]);
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
        opensAt: TENANCY_NOW + DAY,
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
            language: LANGUAGE,
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

  it.effect(
    "lists the newest four drafts of the viewer, and no draft of another author",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* Effect.forEach(
          Arr.makeBy(5, (index) => index + 1),
          (index) =>
            Effect.sync(() => vi.setSystemTime(TENANCY_NOW + index)).pipe(
              Effect.andThen(teacherExam(fixture, `Draf ${index}`))
            ),
          { discard: true }
        );
        yield* fixture.as("admin").mutation(create, {
          language: LANGUAGE,
          scope: { kind: "tenant" },
          slug: nf,
          title: "Milik admin",
        });

        const read = yield* homeOf(fixture, "teacher");

        expect(titlesOf(read.drafts)).toEqual([
          "Draf 5",
          "Draf 4",
          "Draf 3",
          "Draf 2",
        ]);
      })
  );

  it.effect("drops a draft that its author may no longer edit", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      yield* teacherExam(fixture, "PTS");
      yield* fixture.run(archiveUnit(fixture.units.smp));

      const read = yield* homeOf(fixture, "teacher");

      expect(read.drafts).toEqual([]);
    })
  );

  it.effect(
    "lists an older draft that the author may edit, past newer drafts in an archived unit",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* teacherExam(fixture, "PTS lama");
        yield* Effect.forEach(
          Arr.makeBy(4, (index) => index + 1),
          (index) =>
            Effect.sync(() => vi.setSystemTime(TENANCY_NOW + index)).pipe(
              Effect.andThen(
                fixture.run(
                  Effect.flatMap(DatabaseWriter, (writer) =>
                    writer.table("exams").insert({
                      createdAt: TENANCY_NOW + index,
                      createdBy: fixture.users.teacher.userId,
                      language: LANGUAGE,
                      questions: [],
                      scope: { kind: "unit", unitId: fixture.units.smk },
                      tenantId: fixture.tenants.nf,
                      title: `Terkunci ${index}`,
                    })
                  ).pipe(Effect.orDie)
                )
              )
            ),
          { discard: true }
        );

        const read = yield* homeOf(fixture, "teacher");

        expect(titlesOf(read.drafts)).toEqual(["PTS lama"]);
      })
  );
});
