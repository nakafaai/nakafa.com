import { beforeEach, describe, expect, it } from "@effect/vitest";
import type { ExamSittingsDoc } from "@repo/backend/confect/_generated/docs";
import refs from "@repo/backend/confect/_generated/refs";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import type { ExamSummary } from "@repo/backend/confect/exams/exam";
import type { ClosedView } from "@repo/backend/confect/exams/home/contract";
import type { SittingView } from "@repo/backend/confect/exams/sittings/contract";
import { nf } from "@repo/backend/test/editor";
import { archiveUnit, LANGUAGE, teacherExam } from "@repo/backend/test/exams";
import {
  CLOSES_AT,
  OPENS_AT,
  type SittingFixture,
  seedPlacement,
} from "@repo/backend/test/sittings";
import { TENANCY_NOW, tenancyFixture } from "@repo/backend/test/tenancy";
import { Array as Arr, Effect } from "effect";

const { create, home } = refs.public.exams.exams;

/** One day, in milliseconds. */
const DAY = 86_400_000;

/** The fields of one room that a test seeds, as the scheduler would leave it. */
type RoomSeed = Pick<ExamSittingsDoc, "examId" | "opensAt" | "state"> &
  Partial<
    Pick<
      ExamSittingsDoc,
      | "closesAt"
      | "cohortId"
      | "resultsReleasedAt"
      | "room"
      | "tenantId"
      | "unitId"
    >
  >;

/** Writes one room with its token left out, so a test starts from the room's state. */
const insertRoom = (fixture: SittingFixture, seed: RoomSeed) =>
  fixture.run(
    Effect.flatMap(DatabaseWriter, (writer) =>
      writer.table("examSittings").insert({
        closesAt: seed.closesAt ?? CLOSES_AT,
        cohortId: seed.cohortId ?? null,
        examId: seed.examId,
        jobs: [],
        opensAt: seed.opensAt,
        room: seed.room ?? "Lab 2",
        state: seed.state,
        tenantId: seed.tenantId ?? fixture.tenants.nf,
        tokenHash: "",
        tokenIssuedAt: TENANCY_NOW,
        tokenSealed: new ArrayBuffer(0),
        unitId: seed.unitId ?? fixture.units.smp,
        ...(seed.resultsReleasedAt === undefined
          ? {}
          : { resultsReleasedAt: seed.resultsReleasedAt }),
      })
    ).pipe(Effect.orDie)
  );

/** The rooms of a results list with their release flags, in order. */
const resultsOf = (rows: readonly (typeof ClosedView.Type)[]) =>
  Arr.map(rows, (row) => ({
    canRelease: row.canRelease,
    resultsReleased: row.resultsReleased,
    room: row.room,
  }));

/** Reads the school home as one account of the fixture. */
const homeOf = (
  fixture: SittingFixture,
  account: keyof SittingFixture["users"]
) => fixture.as(account).query(home, { slug: nf });

/** The titles of a list of exams, in order. */
const titlesOf = (exams: readonly (typeof ExamSummary.Type)[]) =>
  Arr.map(exams, (exam) => exam.title);

/** The rooms of a list, by their names, in order. */
const roomsOf = (rooms: readonly (typeof SittingView.Type)[]) =>
  Arr.map(rooms, (room) => room.room);

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

        expect(read).toEqual({ closed: [], drafts: [], live: [], next: [] });
      })
  );

  it.effect(
    "lists the closed sittings a teacher may view results of, newest first, with their release flags",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const exam = yield* teacherExam(fixture, "PTS Biologi");
        yield* insertRoom(fixture, {
          examId: exam.id,
          opensAt: OPENS_AT,
          resultsReleasedAt: TENANCY_NOW,
          room: "Lab 2",
          state: "closed",
        });
        yield* insertRoom(fixture, {
          examId: exam.id,
          opensAt: OPENS_AT + 1,
          room: "Lab 3",
          state: "closed",
        });

        const read = yield* homeOf(fixture, "teacher");

        // The teacher wrote the exam, so the teacher may release its results too (the exam's author).
        expect(resultsOf(read.closed)).toEqual([
          { canRelease: true, resultsReleased: false, room: "Lab 3" },
          { canRelease: true, resultsReleased: true, room: "Lab 2" },
        ]);
      })
  );

  it.effect(
    "lets the admin release the results of every unit's closed sittings, and no other role",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const exam = yield* teacherExam(fixture, "PTS");
        yield* insertRoom(fixture, {
          examId: exam.id,
          opensAt: OPENS_AT,
          room: "Lab 2",
          state: "closed",
        });
        yield* insertRoom(fixture, {
          examId: exam.id,
          opensAt: OPENS_AT + 1,
          room: "Lab SMA",
          state: "closed",
          unitId: fixture.units.sma,
        });

        const admin = yield* homeOf(fixture, "admin");
        const principal = yield* homeOf(fixture, "principal");

        expect(resultsOf(admin.closed)).toEqual([
          { canRelease: true, resultsReleased: false, room: "Lab SMA" },
          { canRelease: true, resultsReleased: false, room: "Lab 2" },
        ]);
        expect(resultsOf(principal.closed)).toEqual([
          { canRelease: false, resultsReleased: false, room: "Lab SMA" },
        ]);
      })
  );

  it.effect(
    "shows no closed sitting of a unit the viewer does not watch",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const exam = yield* teacherExam(fixture, "PTS");
        yield* insertRoom(fixture, {
          examId: exam.id,
          opensAt: OPENS_AT,
          room: "Lab SMA",
          state: "closed",
          unitId: fixture.units.sma,
        });

        const read = yield* homeOf(fixture, "teacher");

        expect(read.closed).toEqual([]);
      })
  );

  it.effect(
    "lists at most five closed sittings, the newest ones",
    () =>
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
              state: "closed",
            }),
          { discard: true }
        );

        const read = yield* homeOf(fixture, "teacher");

        expect(roomsOf(read.closed)).toEqual([
          "Lab 6",
          "Lab 5",
          "Lab 4",
          "Lab 3",
          "Lab 2",
        ]);
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
