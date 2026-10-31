import { beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { nf } from "@repo/backend/test/editor";
import {
  CLOSES_AT as CLOSES,
  deviceOf,
  enterOk,
  OPENS_AT as OPENS,
  openedSitting,
} from "@repo/backend/test/sittings";
import { TENANCY_NOW, tenancyFixture } from "@repo/backend/test/tenancy";
import { Effect } from "effect";

const { lock, student } = refs.public.exams.sittings;

describe("exams/sittings attempt", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TENANCY_NOW);
  });

  it.effect("gives no attempt to a student before the student enters", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const made = yield* openedSitting(fixture, "PTS");
      const view = yield* fixture
        .as("student")
        .query(student, { sittingId: made.id, slug: nf });
      expect(view.attempt).toBeNull();
    })
  );

  it.effect(
    "gives the student its own attempt after entry, and shows a lock at once",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const made = yield* openedSitting(fixture, "PTS");
        const entered = yield* enterOk(fixture, {
          deviceId: deviceOf(1),
          sittingId: made.id,
          token: made.token,
        });
        const view = yield* fixture
          .as("student")
          .query(student, { sittingId: made.id, slug: nf });
        expect(view.attempt).toEqual({
          deadline: CLOSES,
          id: entered.attempt,
          startedAt: OPENS,
          state: "inProgress",
        });
        yield* fixture.as("teacher").mutation(lock, {
          attemptId: entered.attempt,
          reason: "other",
          sittingId: made.id,
          slug: nf,
        });
        const locked = yield* fixture
          .as("student")
          .query(student, { sittingId: made.id, slug: nf });
        expect(locked.attempt).toMatchObject({
          id: entered.attempt,
          state: "locked",
        });
      })
  );

  it.effect("refuses a proctor the student view of a sitting it proctors", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const made = yield* openedSitting(fixture, "PTS");
      yield* enterOk(fixture, {
        deviceId: deviceOf(1),
        sittingId: made.id,
        token: made.token,
      });
      const refused = yield* fixture
        .as("teacher")
        .query(student, { sittingId: made.id, slug: nf })
        .pipe(Effect.flip);
      expect(refused).toMatchObject({ _tag: "NotInSitting" });
    })
  );
});
