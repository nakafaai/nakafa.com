import type { GenericId } from "@confect/core";
import { beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { WRITE_ALLOWANCE_MS } from "@repo/backend/confect/exams/sittings/gate";
import { nf } from "@repo/backend/test/editor";
import {
  deviceOf,
  enterOk,
  openedSitting,
  type SittingFixture,
} from "@repo/backend/test/sittings";
import { TENANCY_NOW, tenancyFixture } from "@repo/backend/test/tenancy";
import { Effect } from "effect";

const { answer, paper } = refs.public.exams.sittings;

/**
 * A sitting that the student entered from device 1, with its attempt moved to `state` and `deadline`, and the
 * call that answers the first question of its exam with the given version.
 */
const passedAttempt = (
  fixture: SittingFixture,
  fields: { readonly deadline: number; readonly state: "closing" | "locked" }
) =>
  Effect.gen(function* () {
    const made = yield* openedSitting(fixture, "PTS");
    yield* enterOk(fixture, {
      deviceId: deviceOf(1),
      sittingId: made.id,
      token: made.token,
    });
    const { questions } = yield* fixture
      .as("student")
      .query(paper, { deviceId: deviceOf(1), sittingId: made.id, slug: nf });
    yield* moveAttempt(fixture, made.id, fields);
    return (version: number) =>
      fixture.as("student").mutation(answer, {
        deviceId: deviceOf(1),
        questionId: questions[0].id,
        response: ["option-1"],
        sittingId: made.id,
        slug: nf,
        version,
      });
  });

/** Moves the sitting's attempt in progress to the given state and deadline. */
const moveAttempt = (
  fixture: SittingFixture,
  sittingId: GenericId.GenericId<"examSittings">,
  fields: { readonly deadline: number; readonly state: "closing" | "locked" }
) =>
  fixture.run(
    Effect.gen(function* () {
      const attempt = yield* (yield* DatabaseReader)
        .table("examAttempts")
        .index("by_sittingId_and_state_and_deadline", (query) =>
          query.eq("sitting", sittingId).eq("state", "inProgress")
        )
        .first()
        .pipe(Effect.orDie, Effect.flatMap(Effect.fromOption), Effect.orDie);
      yield* (yield* DatabaseWriter)
        .table("examAttempts")
        .patch(attempt._id, fields)
        .pipe(Effect.orDie);
    })
  );

describe("exams/sittings gate", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TENANCY_NOW);
  });

  it.effect(
    "takes an answer in flight past the deadline of a closing attempt, and none once the allowance ends",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const send = yield* passedAttempt(fixture, {
          deadline: TENANCY_NOW,
          state: "closing",
        });
        vi.setSystemTime(TENANCY_NOW + WRITE_ALLOWANCE_MS - 1);
        yield* send(1);
        vi.setSystemTime(TENANCY_NOW + WRITE_ALLOWANCE_MS);
        expect(yield* send(2).pipe(Effect.flip)).toMatchObject({
          _tag: "AttemptClosed",
        });
      })
  );

  it.effect("keeps a locked attempt shut through the allowance", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const send = yield* passedAttempt(fixture, {
        deadline: TENANCY_NOW - 1,
        state: "locked",
      });
      expect(yield* send(1).pipe(Effect.flip)).toMatchObject({
        _tag: "AttemptLocked",
      });
    })
  );
});
