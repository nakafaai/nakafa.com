import type { GenericId } from "@confect/core";
import { beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { Scheduler } from "@repo/backend/confect/_generated/services";
import { cancelPending } from "@repo/backend/confect/exams/sittings/timers";
import { nf } from "@repo/backend/test/editor";
import {
  CLOSES_AT as CLOSES,
  jobStateOf,
  keyedExam,
  keyedSchool,
  OPENS_AT as OPENS,
  scheduleSitting,
  sittingRow,
} from "@repo/backend/test/sittings";
import { TENANCY_NOW, tenancyFixture } from "@repo/backend/test/tenancy";
import { Duration, Effect, Option, Ref } from "effect";

const { close } = refs.public.exams.sittings;

describe("exams/sittings timers", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TENANCY_NOW);
  });

  it.effect("cancels a job that is still pending", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      yield* keyedSchool(fixture);
      const examId = yield* keyedExam(fixture, "PTS");
      const made = yield* scheduleSitting(fixture, {
        closesAt: CLOSES,
        examId,
        group: { kind: "unit", unitId: fixture.units.smp },
        opensAt: OPENS,
      });
      const [openJob] = (yield* sittingRow(fixture, made.id)).jobs;
      expect(yield* jobStateOf(fixture, openJob)).toBe("pending");
      yield* fixture.run(cancelPending(openJob));
      expect(yield* jobStateOf(fixture, openJob)).toBe("canceled");
    })
  );

  it.effect(
    "leaves a job that has run alone, and the proctor's close still succeeds",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* keyedSchool(fixture);
        const examId = yield* keyedExam(fixture, "PTS");
        const made = yield* scheduleSitting(fixture, {
          closesAt: CLOSES,
          examId,
          group: { kind: "unit", unitId: fixture.units.smp },
          opensAt: OPENS,
        });
        yield* fixture.advanceScheduled(OPENS - TENANCY_NOW);
        const [openJob, closeJob] = (yield* sittingRow(fixture, made.id)).jobs;
        expect(yield* sittingRow(fixture, made.id)).toMatchObject({
          state: "open",
        });
        expect(yield* jobStateOf(fixture, openJob)).toBe("success");
        yield* fixture
          .as("teacher")
          .mutation(close, { sittingId: made.id, slug: nf });
        expect(yield* jobStateOf(fixture, openJob)).toBe("success");
        expect(yield* jobStateOf(fixture, closeJob)).toBe("canceled");
        expect(yield* sittingRow(fixture, made.id)).toMatchObject({
          state: "closed",
        });
      })
  );

  it.effect("leaves a job alone when no row holds it", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      yield* keyedSchool(fixture);
      const examId = yield* keyedExam(fixture, "PTS");
      const made = yield* scheduleSitting(fixture, {
        closesAt: CLOSES,
        examId,
        group: { kind: "unit", unitId: fixture.units.smp },
        opensAt: OPENS,
      });
      // The transaction schedules a job and then fails, so the transaction rolls back and
      // no row keeps the job. The ID it returned names nothing.
      const scheduled = yield* Ref.make(
        Option.none<GenericId.GenericId<"_scheduled_functions">>()
      );
      yield* fixture
        .run(
          Effect.gen(function* () {
            const jobId = yield* (yield* Scheduler).runAfter(
              Duration.minutes(1),
              refs.internal.exams.sittings.timers.open,
              { sittingId: made.id }
            );
            yield* Ref.set(scheduled, Option.some(jobId));
            return yield* Effect.die("the transaction rolls back");
          })
        )
        .pipe(Effect.exit);
      const found = yield* Ref.get(scheduled);
      if (Option.isNone(found)) {
        return yield* Effect.die("the transaction must have scheduled a job");
      }
      const jobId = found.value;
      expect(yield* jobStateOf(fixture, jobId)).toBeNull();
      yield* fixture.run(cancelPending(jobId));
      expect(yield* jobStateOf(fixture, jobId)).toBeNull();
    })
  );
});
