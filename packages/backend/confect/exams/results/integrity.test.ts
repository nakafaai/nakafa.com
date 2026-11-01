import type { GenericId } from "@confect/core";
import { beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import { nf } from "@repo/backend/test/editor";
import {
  CLOSES_AT,
  openedSitting,
  type SittingFixture,
  seedAttempt,
  seedSignal,
} from "@repo/backend/test/sittings";
import { TENANCY_NOW, tenancyFixture } from "@repo/backend/test/tenancy";
import { Array as Arr, Effect, Schema } from "effect";

const { integrity } = refs.public.exams.results.results;

/** The exits and the time away that a submission stores. */
const StoredIntegrity = Schema.NullOr(
  Schema.Struct({ awaySeconds: Schema.Finite, exits: Schema.Finite })
);

/** A finished attempt, with the exits and the time away its submission stored. */
const finishedAttempt = Effect.fn("test.integrity.finished")(function* (
  fixture: SittingFixture,
  sittingId: GenericId.GenericId<"examSittings">,
  stored: typeof StoredIntegrity.Type
) {
  const attempt = yield* seedAttempt(fixture, {
    deadline: CLOSES_AT,
    deviceId: null,
    person: fixture.invited,
    sittingId,
    state: "submitted",
  });
  if (stored !== null) {
    yield* fixture.run(
      Effect.flatMap(DatabaseWriter, (writer) =>
        writer.table("examAttempts").patch(attempt, { integrity: stored })
      ).pipe(Effect.orDie)
    );
  }
  return attempt;
});

describe("exams/results integrity", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TENANCY_NOW);
  });

  it.effect(
    "lists who showed a signal, most time away first, and leaves out who showed none",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const room = yield* openedSitting(fixture, "PTS");
        const briefly = yield* finishedAttempt(fixture, room.id, {
          awaySeconds: 30,
          exits: 1,
        });
        const longest = yield* finishedAttempt(fixture, room.id, {
          awaySeconds: 300,
          exits: 1,
        });
        const often = yield* finishedAttempt(fixture, room.id, {
          awaySeconds: 30,
          exits: 4,
        });
        yield* finishedAttempt(fixture, room.id, null);
        const copied = yield* finishedAttempt(fixture, room.id, null);
        yield* seedSignal(fixture, {
          at: TENANCY_NOW,
          attemptId: copied,
          kind: "copy",
        });
        yield* seedSignal(fixture, {
          at: TENANCY_NOW + 1,
          attemptId: copied,
          kind: "copy",
        });
        yield* seedSignal(fixture, {
          at: TENANCY_NOW + 2,
          attemptId: copied,
          kind: "disconnect",
        });
        // A return is no signal of its own: it only ends a time away.
        const returned = yield* finishedAttempt(fixture, room.id, null);
        yield* seedSignal(fixture, {
          at: TENANCY_NOW,
          attemptId: returned,
          kind: "return",
        });

        const report = yield* fixture
          .as("teacher")
          .query(integrity, { sittingId: room.id, slug: nf });

        expect(report.students).toBe(6);
        expect(Arr.map(report.rows, (row) => row.attemptId)).toEqual([
          longest,
          often,
          briefly,
          copied,
        ]);
        expect(report.rows[3]).toMatchObject({
          awaySeconds: 0,
          blur: 0,
          copy: 2,
          disconnect: 1,
          exits: 0,
          fullscreenExit: 0,
          paste: 0,
          secondTab: 0,
        });
      })
  );

  it.effect("counts only the students who finished", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const room = yield* openedSitting(fixture, "PTS");
      const running = yield* seedAttempt(fixture, {
        deadline: CLOSES_AT,
        deviceId: null,
        person: fixture.invited,
        sittingId: room.id,
        state: "inProgress",
      });
      yield* seedSignal(fixture, {
        at: TENANCY_NOW,
        attemptId: running,
        kind: "paste",
      });

      expect(
        yield* fixture
          .as("teacher")
          .query(integrity, { sittingId: room.id, slug: nf })
      ).toEqual({ rows: [], students: 0 });
    })
  );

  it.effect("keeps the report from a student", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const room = yield* openedSitting(fixture, "PTS");
      const refused = yield* fixture
        .as("student")
        .query(integrity, { sittingId: room.id, slug: nf })
        .pipe(Effect.flip);

      expect(refused).toMatchObject({ _tag: "AccessDenied" });
    })
  );
});
