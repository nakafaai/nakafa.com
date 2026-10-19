import { beforeEach, describe, expect, it } from "@effect/vitest";
import type { ClosedView } from "@repo/backend/confect/exams/home/contract";
import { teacherExam } from "@repo/backend/test/exams";
import { homeOf, insertRoom, roomsOf } from "@repo/backend/test/home";
import { OPENS_AT } from "@repo/backend/test/sittings";
import { TENANCY_NOW, tenancyFixture } from "@repo/backend/test/tenancy";
import { Array as Arr, Effect } from "effect";

/** The rooms of a results list with their release flags, in order. */
const resultsOf = (rows: readonly (typeof ClosedView.Type)[]) =>
  Arr.map(rows, (row) => ({
    canRelease: row.canRelease,
    resultsReleased: row.resultsReleased,
    room: row.room,
  }));

describe("exams home results", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TENANCY_NOW);
  });

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

  it.effect("shows no closed sitting of a unit the viewer does not watch", () =>
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

  it.effect("lists at most five closed sittings, the newest ones", () =>
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
});
