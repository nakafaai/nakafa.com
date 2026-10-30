import type { GenericId } from "@confect/core";
import { beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { nf } from "@repo/backend/test/editor";
import {
  admittedOf,
  attemptRow,
  CLOSES_AT,
  deviceOf,
  keyedExam,
  keyedSchool,
  OPENS_AT,
  openedSitting,
  type SittingFixture,
  scheduleSitting,
  seedAttempt,
  sittingRow,
} from "@repo/backend/test/sittings";
import {
  journal,
  scheduledJobs,
  TENANCY_NOW,
  tenancyFixture,
} from "@repo/backend/test/tenancy";
import { Array as Arr, Effect } from "effect";

const timers = refs.internal.exams.sittings.timers;

/** The blueprint's disconnect window, which the submission waits after a deadline. */
const SUBMIT_DELAY = 75_000;

/** The states of every attempt of a sitting, read in one bounded page. */
const statesOf = (
  fixture: SittingFixture,
  sittingId: GenericId.GenericId<"examSittings">
) =>
  fixture.run(
    Effect.flatMap(DatabaseReader, (reader) =>
      Effect.map(
        reader
          .table("examAttempts")
          .index("by_sittingId", (query) => query.eq("sitting", sittingId))
          .take(200)
          .pipe(Effect.orDie),
        (rows) => Arr.map(rows, (row) => row.state)
      )
    )
  );

describe("exams/sittings closing", () => {
  it.effect(
    "closes the sitting: it cancels its jobs, freezes the exam, closes each open attempt, and records the close",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const made = yield* openedSitting(fixture, "PTS");
        const entered = yield* fixture
          .as("student")
          .mutation(refs.public.exams.sittings.enter, {
            deviceId: deviceOf(1),
            sittingId: made.id,
            slug: nf,
            token: made.token,
          })
          .pipe(Effect.flatMap(admittedOf));
        yield* fixture
          .as("teacher")
          .mutation(refs.public.exams.sittings.close, {
            sittingId: made.id,
            slug: nf,
          });
        const jobs = yield* fixture.run(scheduledJobs);
        const openJobs = Arr.filter(jobs, (job) => job.name.endsWith(":open"));
        const closeAtJobs = Arr.filter(
          jobs,
          (job) => job.scheduledTime === CLOSES_AT
        );
        expect(Arr.map(openJobs, (job) => job.state.kind)).toEqual([
          "canceled",
        ]);
        expect(Arr.map(closeAtJobs, (job) => job.state.kind)).toEqual([
          "canceled",
        ]);
        const closed = yield* sittingRow(fixture, made.id);
        expect(closed).toMatchObject({ state: "closed" });
        // A finished sitting fixes the paper its students sat (ADR 0031).
        const exam = yield* fixture.run(
          Effect.flatMap(DatabaseReader, (reader) =>
            reader.table("exams").get(closed.examId).pipe(Effect.orDie)
          )
        );
        expect(exam.frozenAt).toBe(OPENS_AT);
        yield* fixture.internal.mutation(timers.closeDue, {
          atDeadline: "now",
          sittingId: made.id,
        });
        expect(yield* attemptRow(fixture, entered.attempt)).toMatchObject({
          state: "closing",
        });
        const closedSignal = yield* fixture
          .as("student")
          .mutation(refs.public.exams.sittings.signal, {
            attemptId: entered.attempt,
            deviceId: deviceOf(1),
            kind: "blur",
            slug: nf,
          })
          .pipe(Effect.flip);
        expect(closedSignal).toMatchObject({ _tag: "AttemptClosed" });
        const entries = yield* fixture.run(journal);
        expect(Arr.map(entries, (entry) => entry.change)).toContainEqual({
          type: "sitting.close",
        });
      })
  );

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TENANCY_NOW);
  });

  it.effect(
    "schedules the opening and the closing of a sitting at their own times",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* keyedSchool(fixture);
        const examId = yield* keyedExam(fixture, "PTS");
        yield* scheduleSitting(fixture, {
          closesAt: CLOSES_AT,
          examId,
          group: { kind: "unit", unitId: fixture.units.smp },
          opensAt: OPENS_AT,
        });
        const jobs = yield* fixture.run(scheduledJobs);
        expect(
          Arr.filter(jobs, (job) => job.scheduledTime === OPENS_AT)
        ).toHaveLength(1);
        expect(
          Arr.filter(jobs, (job) => job.scheduledTime === CLOSES_AT)
        ).toHaveLength(1);
      })
  );

  it.effect(
    "opens a scheduled sitting, and leaves a sitting that was closed before its opening alone",
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
        yield* fixture.internal.mutation(timers.open, { sittingId: made.id });
        expect(yield* sittingRow(fixture, made.id)).toMatchObject({
          state: "open",
        });
        const closed = yield* scheduleSitting(fixture, {
          closesAt: CLOSES_AT,
          examId,
          group: { kind: "unit", unitId: fixture.units.smp },
          opensAt: OPENS_AT,
        });
        yield* fixture
          .as("teacher")
          .mutation(refs.public.exams.sittings.close, {
            sittingId: closed.id,
            slug: nf,
          });
        yield* fixture.internal.mutation(timers.open, { sittingId: closed.id });
        expect(yield* sittingRow(fixture, closed.id)).toMatchObject({
          state: "closed",
        });
      })
  );

  it.effect(
    "closes the attempts due at the sitting's closing time, and leaves an extended attempt open",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const made = yield* openedSitting(fixture, "PTS");
        const dueReply = yield* fixture
          .as("student")
          .mutation(refs.public.exams.sittings.enter, {
            deviceId: "00000000-0000-4000-8000-000000000001",
            sittingId: made.id,
            slug: nf,
            token: made.token,
          });
        const due = yield* admittedOf(dueReply);
        const extended = yield* seedAttempt(fixture, {
          deadline: CLOSES_AT + 60_000,
          deviceId: null,
          person: fixture.invited,
          sittingId: made.id,
          state: "inProgress",
        });
        vi.setSystemTime(CLOSES_AT);
        yield* fixture.internal.mutation(timers.closeDue, {
          atDeadline: "closesAt",
          sittingId: made.id,
        });
        expect(yield* attemptRow(fixture, due.attempt)).toMatchObject({
          deadline: CLOSES_AT,
          state: "closing",
        });
        expect(yield* attemptRow(fixture, extended)).toMatchObject({
          state: "inProgress",
        });
        expect(yield* sittingRow(fixture, made.id)).toMatchObject({
          state: "closed",
        });
        vi.setSystemTime(CLOSES_AT + SUBMIT_DELAY);
        yield* fixture.internal.mutation(timers.submit, {
          attemptId: due.attempt,
        });
        expect(yield* attemptRow(fixture, due.attempt)).toMatchObject({
          state: "submitted",
          submittedAt: CLOSES_AT + SUBMIT_DELAY,
        });
        yield* fixture.internal.mutation(timers.submit, {
          attemptId: due.attempt,
        });
        expect(yield* attemptRow(fixture, due.attempt)).toMatchObject({
          state: "submitted",
          submittedAt: CLOSES_AT + SUBMIT_DELAY,
        });
      })
  );

  it.effect(
    "closes an extended attempt at its own deadline, and leaves it open before that",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const made = yield* openedSitting(fixture, "PTS");
        const extended = yield* seedAttempt(fixture, {
          deadline: CLOSES_AT + 60_000,
          deviceId: null,
          person: fixture.invited,
          sittingId: made.id,
          state: "locked",
        });
        vi.setSystemTime(CLOSES_AT + 30_000);
        yield* fixture.internal.mutation(timers.closeAttempt, {
          attemptId: extended,
        });
        expect(yield* attemptRow(fixture, extended)).toMatchObject({
          state: "locked",
        });
        vi.setSystemTime(CLOSES_AT + 60_000);
        yield* fixture.internal.mutation(timers.closeAttempt, {
          attemptId: extended,
        });
        expect(yield* attemptRow(fixture, extended)).toMatchObject({
          state: "closing",
        });
        yield* fixture.internal.mutation(timers.closeAttempt, {
          attemptId: extended,
        });
        expect(yield* attemptRow(fixture, extended)).toMatchObject({
          state: "closing",
        });
      })
  );

  it.effect(
    "sets every open deadline to now when a proctor closes the sitting, and keeps an earlier deadline",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const made = yield* openedSitting(fixture, "PTS");
        const open = yield* seedAttempt(fixture, {
          deadline: CLOSES_AT,
          deviceId: null,
          person: fixture.invited,
          sittingId: made.id,
          state: "inProgress",
        });
        const past = yield* seedAttempt(fixture, {
          deadline: OPENS_AT,
          deviceId: null,
          person: fixture.invited,
          sittingId: made.id,
          state: "locked",
        });
        vi.setSystemTime(OPENS_AT + 5000);
        yield* fixture
          .as("teacher")
          .mutation(refs.public.exams.sittings.close, {
            sittingId: made.id,
            slug: nf,
          });
        yield* fixture.internal.mutation(timers.closeDue, {
          atDeadline: "now",
          sittingId: made.id,
        });
        expect(yield* attemptRow(fixture, open)).toMatchObject({
          deadline: OPENS_AT + 5000,
          state: "closing",
        });
        expect(yield* attemptRow(fixture, past)).toMatchObject({
          deadline: OPENS_AT,
          state: "closing",
        });
      })
  );

  it.effect(
    "closes one page of a hundred attempts at a time, and the next run closes the rest",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const made = yield* openedSitting(fixture, "PTS");
        for (let index = 0; index < 101; index += 1) {
          yield* seedAttempt(fixture, {
            deadline: CLOSES_AT,
            deviceId: null,
            person: fixture.invited,
            sittingId: made.id,
            state: "inProgress",
          });
        }
        vi.setSystemTime(CLOSES_AT);
        yield* fixture.internal.mutation(timers.closeDue, {
          atDeadline: "closesAt",
          sittingId: made.id,
        });
        const afterFirst = yield* statesOf(fixture, made.id);
        expect(
          Arr.filter(afterFirst, (state) => state === "closing")
        ).toHaveLength(100);
        yield* fixture.internal.mutation(timers.closeDue, {
          atDeadline: "closesAt",
          sittingId: made.id,
        });
        const afterSecond = yield* statesOf(fixture, made.id);
        expect(
          Arr.filter(afterSecond, (state) => state === "closing")
        ).toHaveLength(101);
      })
  );

  it.effect(
    "moves an attempt that a proctor has not closed to submitted only after the window, and not before",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const made = yield* openedSitting(fixture, "PTS");
        const open = yield* seedAttempt(fixture, {
          deadline: CLOSES_AT,
          deviceId: null,
          person: fixture.invited,
          sittingId: made.id,
          state: "inProgress",
        });
        yield* fixture.internal.mutation(timers.submit, { attemptId: open });
        expect(yield* attemptRow(fixture, open)).toMatchObject({
          state: "inProgress",
        });
      })
  );
});
