import { beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import { nf } from "@repo/backend/test/editor";
import {
  CLOSES_AT as CLOSES,
  keyedExam,
  keyedSchool,
  OPENS_AT as OPENS,
  openedSitting,
  scheduleSitting,
  seedAttempt,
  seedSignal,
} from "@repo/backend/test/sittings";
import { TENANCY_NOW, tenancyFixture } from "@repo/backend/test/tenancy";
import { Array as Arr, Effect } from "effect";

const { signals } = refs.public.exams.sittings;

describe("exams/sittings signals", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TENANCY_NOW);
  });

  it.effect("pages an attempt's signals, newest first", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const made = yield* openedSitting(fixture, "PTS");
      const attemptId = yield* seedAttempt(fixture, {
        deadline: CLOSES,
        deviceId: null,
        person: fixture.invited,
        sittingId: made.id,
        state: "inProgress",
      });
      yield* seedSignal(fixture, { at: OPENS + 1, attemptId, kind: "exit" });
      yield* seedSignal(fixture, { at: OPENS + 2, attemptId, kind: "return" });
      yield* seedSignal(fixture, { at: OPENS + 3, attemptId, kind: "blur" });
      const first = yield* fixture.as("teacher").query(signals, {
        attemptId,
        paginationOpts: { cursor: null, numItems: 2 },
        sittingId: made.id,
        slug: nf,
      });
      expect(first.page).toEqual([
        { at: OPENS + 3, kind: "blur" },
        { at: OPENS + 2, kind: "return" },
      ]);
      expect(first.isDone).toBe(false);
      const second = yield* fixture.as("teacher").query(signals, {
        attemptId,
        paginationOpts: { cursor: first.continueCursor, numItems: 2 },
        sittingId: made.id,
        slug: nf,
      });
      expect(second.page).toEqual([{ at: OPENS + 1, kind: "exit" }]);
      expect(second.isDone).toBe(true);
    })
  );

  it.effect("clamps a page of signals to one hundred at most", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const made = yield* openedSitting(fixture, "PTS");
      const attemptId = yield* seedAttempt(fixture, {
        deadline: CLOSES,
        deviceId: null,
        person: fixture.invited,
        sittingId: made.id,
        state: "inProgress",
      });
      yield* fixture.run(
        Effect.asVoid(
          Effect.forEach(
            Arr.makeBy(101, (index) => index),
            (index) =>
              Effect.flatMap(DatabaseWriter, (writer) =>
                writer.table("examSignals").insert({
                  at: OPENS + index,
                  attempt: attemptId,
                  kind: "blur",
                  tenantId: fixture.tenants.nf,
                })
              )
          )
        )
      );
      const page = yield* fixture.as("teacher").query(signals, {
        attemptId,
        paginationOpts: { cursor: null, numItems: 500 },
        sittingId: made.id,
        slug: nf,
      });
      expect(page.page).toHaveLength(100);
      expect(page.isDone).toBe(false);
    })
  );

  it.effect(
    "refuses the signals of an attempt that belongs to another sitting",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* keyedSchool(fixture);
        const examId = yield* keyedExam(fixture, "PTS");
        const first = yield* scheduleSitting(fixture, {
          closesAt: CLOSES,
          examId,
          group: { kind: "unit", unitId: fixture.units.smp },
          opensAt: OPENS,
        });
        const second = yield* scheduleSitting(fixture, {
          closesAt: CLOSES,
          examId,
          group: { kind: "unit", unitId: fixture.units.smp },
          opensAt: OPENS,
        });
        const attemptId = yield* seedAttempt(fixture, {
          deadline: CLOSES,
          deviceId: null,
          person: fixture.invited,
          sittingId: first.id,
          state: "inProgress",
        });
        const failure = yield* fixture
          .as("teacher")
          .query(signals, {
            attemptId,
            paginationOpts: { cursor: null, numItems: 10 },
            sittingId: second.id,
            slug: nf,
          })
          .pipe(Effect.flip);
        expect(failure).toMatchObject({
          _tag: "AccessDenied",
          reason: "resource",
        });
      })
  );

  it.effect("refuses the signals to a student, who holds no sitting view", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const made = yield* openedSitting(fixture, "PTS");
      const attemptId = yield* seedAttempt(fixture, {
        deadline: CLOSES,
        deviceId: null,
        person: fixture.invited,
        sittingId: made.id,
        state: "inProgress",
      });
      const failure = yield* fixture
        .as("student")
        .query(signals, {
          attemptId,
          paginationOpts: { cursor: null, numItems: 10 },
          sittingId: made.id,
          slug: nf,
        })
        .pipe(Effect.flip);
      expect(failure).toMatchObject({ _tag: "AccessDenied", reason: "role" });
    })
  );
});
