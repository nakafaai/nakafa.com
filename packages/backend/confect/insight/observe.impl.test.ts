import type { GenericId } from "@confect/core";
import { beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { MAX_EXAM_QUESTIONS } from "@repo/backend/confect/exams/exam";
import { keyedFixture } from "@repo/backend/test/classroom";
import { openClass, sat, scored } from "@repo/backend/test/insight";
import { keyedExam, scheduleSitting } from "@repo/backend/test/sittings";
import { TENANCY_NOW, type tenancyFixture } from "@repo/backend/test/tenancy";
import { Array as Arr, Effect } from "effect";

const { run } = refs.internal.insight.observe;

/** The rows of a table, as a test reads them. */
const scores = Effect.flatMap(DatabaseReader, (reader) =>
  reader.table("insightScores").index("by_at").take(10).pipe(Effect.orDie)
);

/** A student's standings in a period. */
const standingsIn = (periodId: GenericId.GenericId<"tenantPeriods">) =>
  Effect.flatMap(DatabaseReader, (reader) =>
    reader
      .table("insightMastery")
      .index("by_periodId", (query) => query.eq("periodId", periodId))
      .take(2)
      .pipe(Effect.orDie)
  );

/** A sitting of the whole unit, with one scored answer of the student. */
const unitSitting = Effect.fn("test.insight.unit")(function* (
  fixture: Effect.Success<typeof tenancyFixture>,
  classId: GenericId.GenericId<"classes">
) {
  const made = yield* sat(fixture, classId);
  const sitting = yield* scheduleSitting(fixture, {
    closesAt: TENANCY_NOW + 2000,
    examId: yield* keyedExam(fixture, "Ujian Unit"),
    group: { kind: "unit", unitId: fixture.units.smp },
    opensAt: TENANCY_NOW + 1000,
  });
  const inUnit = { ...made, sittingId: sitting.id };
  yield* scored(fixture, inUnit, Arr.getUnsafe(made.questions, 0), 1);
  return inUnit;
});

describe("insight/observe", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TENANCY_NOW);
  });

  it.effect(
    "tests the standing a student came with against their whole sitting",
    () =>
      Effect.gen(function* () {
        const fixture = yield* keyedFixture;
        const forum = yield* openClass(fixture);
        const made = yield* sat(fixture, forum.classId);
        const first = Arr.getUnsafe(made.questions, 0);
        const args = { after: null, sittingId: made.sittingId };

        yield* scored(fixture, made, first, 1);
        yield* fixture.internal.mutation(run, args);
        expect(yield* fixture.run(scores)).toEqual([]);

        yield* fixture.internal.mutation(run, args);
        expect(yield* fixture.run(scores)).toMatchObject([
          { count: 1, reached: 1, sittingId: made.sittingId },
        ]);

        yield* fixture.internal.mutation(run, args);
        expect(yield* fixture.run(scores)).toMatchObject([
          { count: 2, reached: 2 },
        ]);
      })
  );

  it.effect("runs on after a full page, from the last student it read", () =>
    Effect.gen(function* () {
      const fixture = yield* keyedFixture;
      const forum = yield* openClass(fixture);
      const made = yield* sat(fixture, forum.classId);
      const first = Arr.getUnsafe(made.questions, 0);
      yield* Effect.forEach(
        Arr.range(1, 200),
        () => scored(fixture, made, first, 1),
        { discard: true }
      );

      yield* fixture.internal.mutation(run, {
        after: null,
        sittingId: made.sittingId,
      });
      yield* fixture.finishScheduled();

      expect(yield* fixture.run(standingsIn(forum.periodId))).toMatchObject([
        { observations: MAX_EXAM_QUESTIONS },
      ]);
    })
  );

  it.effect("counts a unit's sitting in the unit's active period", () =>
    Effect.gen(function* () {
      const fixture = yield* keyedFixture;
      const forum = yield* openClass(fixture);
      const inUnit = yield* unitSitting(fixture, forum.classId);

      yield* fixture.internal.mutation(run, {
        after: null,
        sittingId: inUnit.sittingId,
      });

      expect(yield* fixture.run(standingsIn(forum.periodId))).toHaveLength(1);
    })
  );

  it.effect("leaves out a sitting of a unit with no active period", () =>
    Effect.gen(function* () {
      const fixture = yield* keyedFixture;
      const forum = yield* openClass(fixture);
      const inUnit = yield* unitSitting(fixture, forum.classId);
      yield* fixture.run(
        Effect.flatMap(DatabaseWriter, (writer) =>
          writer
            .table("tenantPeriods")
            .patch(forum.periodId, { status: "archived" })
        ).pipe(Effect.orDie)
      );

      yield* fixture.internal.mutation(run, {
        after: null,
        sittingId: inUnit.sittingId,
      });

      expect(yield* fixture.run(standingsIn(forum.periodId))).toEqual([]);
    })
  );
});
