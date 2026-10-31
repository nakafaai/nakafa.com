import { beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { SWEEP_LATE_MS } from "@repo/backend/confect/exams/sittings/sweep";
import { SUBMIT_DELAY_MS } from "@repo/backend/confect/exams/sittings/timers";
import {
  CLOSES_AT,
  keyedExam,
  keyedSchool,
  OPENS_AT,
  openedSitting,
  type SittingFixture,
  scheduleSitting,
  seedAttempt,
} from "@repo/backend/test/sittings";
import {
  scheduledJobs,
  TENANCY_NOW,
  tenancyFixture,
} from "@repo/backend/test/tenancy";
import { Array as Arr, Effect } from "effect";

const timers = refs.internal.exams.sittings.timers;

/** The steps that one sweep at `at` sends, by the name of each job and its arguments. */
const sweptAt = Effect.fn("test.sittings.swept")(function* (
  fixture: SittingFixture,
  at: number
) {
  vi.setSystemTime(at);
  yield* fixture.internal.mutation(timers.sweep, {});
  const jobs = yield* fixture.run(scheduledJobs);
  return Arr.map(
    Arr.filter(jobs, (job) => job.scheduledTime === at),
    (job) => ({ args: job.args, name: job.name })
  );
});

describe("exams/sittings sweep", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TENANCY_NOW);
  });

  it.effect(
    "sends the opening of a room that its own job did not open, and leaves one that is only busy",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* keyedSchool(fixture);
        const examId = yield* keyedExam(fixture, "PTS");
        const made = yield* scheduleSitting(fixture, {
          closesAt: CLOSES_AT,
          examId,
          group: { kind: "unit", unitId: fixture.units.smp },
          opensAt: OPENS_AT,
        });

        expect(
          yield* sweptAt(fixture, OPENS_AT + SWEEP_LATE_MS - 1)
        ).toHaveLength(0);
        expect(yield* sweptAt(fixture, OPENS_AT + SWEEP_LATE_MS)).toEqual([
          {
            args: [{ sittingId: made.id }],
            name: "exams/sittings/timers:open",
          },
        ]);
      })
  );

  it.effect(
    "sends the close of a room that its own job did not close, and of the attempts that passed their deadline",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const made = yield* openedSitting(fixture, "PTS");
        const due = yield* seedAttempt(fixture, {
          deadline: CLOSES_AT,
          deviceId: null,
          person: fixture.invited,
          sittingId: made.id,
          state: "inProgress",
        });
        const locked = yield* seedAttempt(fixture, {
          deadline: CLOSES_AT,
          deviceId: null,
          person: fixture.invited,
          sittingId: made.id,
          state: "locked",
        });
        yield* seedAttempt(fixture, {
          deadline: CLOSES_AT + 10 * SWEEP_LATE_MS,
          deviceId: null,
          person: fixture.invited,
          sittingId: made.id,
          state: "inProgress",
        });

        expect(
          yield* sweptAt(fixture, CLOSES_AT + SWEEP_LATE_MS - 1)
        ).toHaveLength(0);
        const swept = yield* sweptAt(fixture, CLOSES_AT + SWEEP_LATE_MS);
        expect(swept).toHaveLength(3);
        expect(swept).toEqual(
          expect.arrayContaining([
            {
              args: [{ atDeadline: "closesAt", sittingId: made.id }],
              name: "exams/sittings/timers:closeDue",
            },
            {
              args: [{ attemptId: due }],
              name: "exams/sittings/timers:closeAttempt",
            },
            {
              args: [{ attemptId: locked }],
              name: "exams/sittings/timers:closeAttempt",
            },
          ])
        );
      })
  );

  it.effect(
    "sends the submission of a closing attempt once its window and the lateness have passed",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const made = yield* openedSitting(fixture, "PTS");
        const closing = yield* seedAttempt(fixture, {
          deadline: OPENS_AT,
          deviceId: null,
          person: fixture.invited,
          sittingId: made.id,
          state: "closing",
        });
        const submitAt = OPENS_AT + SUBMIT_DELAY_MS + SWEEP_LATE_MS;

        expect(yield* sweptAt(fixture, submitAt - 1)).toHaveLength(0);
        expect(yield* sweptAt(fixture, submitAt)).toEqual([
          {
            args: [{ attemptId: closing }],
            name: "exams/sittings/timers:submit",
          },
        ]);
      })
  );
});
