import { beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { keyedFixture, nf } from "@repo/backend/test/classroom";
import { openClass, sat, scored } from "@repo/backend/test/insight";
import { TENANCY_NOW } from "@repo/backend/test/tenancy";
import { Array as Arr, DateTime, Effect } from "effect";

const { run } = refs.internal.insight.calibration;
const { ofClass } = refs.public.insight.reads;
const observe = refs.internal.insight.observe.run;

const START = { count: 0, cursor: null, errors: 0, reached: 0 };

/** The first day of a month after the seeded sitting's. */
const NEXT_MONTH = DateTime.toEpochMillis(
  DateTime.add(DateTime.startOf(DateTime.makeUnsafe(TENANCY_NOW), "month"), {
    months: 1,
  })
);

const calibrations = Effect.flatMap(DatabaseReader, (reader) =>
  reader
    .table("insightCalibrations")
    .index("by_month")
    .take(5)
    .pipe(Effect.orDie)
);

const scores = Effect.flatMap(DatabaseReader, (reader) =>
  reader.table("insightScores").index("by_at").take(300).pipe(Effect.orDie)
);

describe("insight/calibration", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TENANCY_NOW);
  });

  it.effect("writes nothing for a month with no scores", () =>
    Effect.gen(function* () {
      const fixture = yield* keyedFixture;
      yield* fixture.internal.mutation(run, START);
      expect(yield* fixture.run(calibrations)).toEqual([]);
    })
  );

  it.effect(
    "counts the month's scores into a verdict that takes the forecast off the screen",
    () =>
      Effect.gen(function* () {
        const fixture = yield* keyedFixture;
        const forum = yield* openClass(fixture);
        const made = yield* sat(fixture, forum.classId);
        yield* scored(fixture, made, Arr.getUnsafe(made.questions, 0), 1);
        const args = { after: null, sittingId: made.sittingId };
        yield* fixture.internal.mutation(observe, args);
        yield* fixture.run(
          Effect.flatMap(DatabaseWriter, (writer) =>
            writer.table("insightScores").insert({
              at: TENANCY_NOW,
              count: 400,
              errors: 100,
              reached: 200,
              sittingId: made.sittingId,
              tenantId: fixture.tenants.nf,
            })
          ).pipe(Effect.orDie)
        );
        vi.setSystemTime(NEXT_MONTH);
        yield* fixture.run(
          Effect.flatMap(DatabaseWriter, (writer) =>
            writer.table("insightScores").insert({
              at: NEXT_MONTH,
              count: 1,
              errors: 0,
              reached: 1,
              sittingId: made.sittingId,
              tenantId: fixture.tenants.nf,
            })
          ).pipe(Effect.orDie)
        );

        yield* fixture.internal.mutation(run, START);

        expect(yield* fixture.run(calibrations)).toMatchObject([
          {
            baseline: 0.25,
            brier: 0.25,
            count: 400,
            month: DateTime.formatIsoDateUtc(
              DateTime.makeUnsafe(TENANCY_NOW)
            ).slice(0, 7),
            passed: false,
          },
        ]);
        expect(yield* fixture.run(scores)).toMatchObject([{ count: 1 }]);
        const seen = yield* fixture
          .as("teacher")
          .query(ofClass, { classId: forum.classId, slug: nf });
        expect(seen.forecasts).toBe(false);
        expect(seen.students[0]?.skills[0]?.chance).toBeNull();
      })
  );

  it.effect("runs on through a full page of scores", () =>
    Effect.gen(function* () {
      const fixture = yield* keyedFixture;
      const forum = yield* openClass(fixture);
      const made = yield* sat(fixture, forum.classId);
      yield* fixture.run(
        Effect.flatMap(DatabaseWriter, (writer) =>
          Effect.forEach(
            Arr.range(1, 201),
            () =>
              writer.table("insightScores").insert({
                at: TENANCY_NOW,
                count: 1,
                errors: 0,
                reached: 1,
                sittingId: made.sittingId,
                tenantId: fixture.tenants.nf,
              }),
            { discard: true }
          )
        ).pipe(Effect.orDie)
      );
      vi.setSystemTime(NEXT_MONTH);

      yield* fixture.internal.mutation(run, START);
      yield* fixture.finishScheduled();

      expect(yield* fixture.run(calibrations)).toMatchObject([{ count: 201 }]);
      expect(yield* fixture.run(scores)).toEqual([]);
    })
  );
});
