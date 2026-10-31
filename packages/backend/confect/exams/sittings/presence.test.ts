import { beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { PRESENCE_INTERVAL } from "@repo/backend/confect/exams/presence";
import { nf } from "@repo/backend/test/editor";
import {
  CLOSES_AT,
  deviceOf,
  enterOk,
  openedSitting,
  type SittingFixture,
  seedAttempt,
  seedSignal,
} from "@repo/backend/test/sittings";
import { TENANCY_NOW, tenancyFixture } from "@repo/backend/test/tenancy";
import { Duration, Effect } from "effect";

const { beat, offline, seats } = refs.public.exams.screens;

/** How long the component keeps a silent session: 2.5 heartbeat intervals. */
const SILENCE = Duration.toMillis(PRESENCE_INTERVAL) * 2.5;

/** Lets a session's silence run out, and the component's close, which takes a second job, land. */
const silenceFalls = (fixture: SittingFixture) =>
  fixture
    .advanceScheduled(SILENCE + 1000)
    .pipe(Effect.andThen(fixture.advanceScheduled(1000)));

/** A sitting the student entered from device 1, with its attempt and the beat of that device. */
const enteredSitting = Effect.fn("test.presence.entered")(function* (
  fixture: SittingFixture
) {
  const made = yield* openedSitting(fixture, "PTS");
  const entered = yield* enterOk(fixture, {
    deviceId: deviceOf(1),
    sittingId: made.id,
    token: made.token,
  });
  return {
    attemptId: entered.attempt,
    beatNow: () =>
      fixture.as("student").mutation(beat, {
        attemptId: entered.attempt,
        deviceId: deviceOf(1),
        session: "student-tab",
        slug: nf,
      }),
    sittingId: made.id,
  };
});

describe("exams/sittings presence", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TENANCY_NOW);
  });

  it.effect(
    "tells the proctor of a student whose beats stopped while the silence lasts, and clears them on the next beat",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const room = yield* enteredSitting(fixture);
        const silent = () =>
          fixture.as("teacher").query(offline, {
            sittingId: room.sittingId,
            slug: nf,
          });

        yield* room.beatNow();
        expect(yield* silent()).toEqual([]);

        yield* silenceFalls(fixture);
        expect(yield* silent()).toEqual([
          { attemptId: room.attemptId, since: expect.any(Number) },
        ]);

        yield* room.beatNow();
        expect(yield* silent()).toEqual([]);
      })
  );

  it.effect("refuses a beat from a device that does not hold the attempt", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const room = yield* enteredSitting(fixture);
      const failure = yield* fixture
        .as("student")
        .mutation(beat, {
          attemptId: room.attemptId,
          deviceId: deviceOf(2),
          session: "other-tab",
          slug: nf,
        })
        .pipe(Effect.flip);

      expect(failure).toMatchObject({ _tag: "SecondDevice" });
    })
  );

  it.effect("adds up how a room's seats read, a lost connection included", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const room = yield* enteredSitting(fixture);
      yield* room.beatNow();
      yield* silenceFalls(fixture);

      const seed = (state: "closing" | "inProgress" | "locked" | "submitted") =>
        seedAttempt(fixture, {
          deadline: CLOSES_AT,
          deviceId: null,
          person: fixture.invited,
          sittingId: room.sittingId,
          state,
        });
      const away = yield* seed("inProgress");
      yield* seedSignal(fixture, {
        attemptId: away,
        at: TENANCY_NOW,
        kind: "exit",
      });
      yield* seed("inProgress");
      yield* seed("locked");
      yield* seed("closing");
      yield* seed("submitted");

      expect(
        yield* fixture
          .as("teacher")
          .query(seats, { sittingId: room.sittingId, slug: nf })
      ).toEqual({
        away: 1,
        finished: 2,
        locked: 1,
        offline: 1,
        working: 1,
      });
    })
  );

  it.effect("keeps a room's seats from a viewer who may not see the room", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const room = yield* enteredSitting(fixture);
      const failure = yield* fixture
        .as("student")
        .query(seats, { sittingId: room.sittingId, slug: nf })
        .pipe(Effect.flip);

      expect(failure).toMatchObject({ _tag: "AccessDenied" });
    })
  );
});
