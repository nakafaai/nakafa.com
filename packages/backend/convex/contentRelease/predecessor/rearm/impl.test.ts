import { describe, expect, it } from "@effect/vitest";
import { internal } from "@repo/backend/convex/_generated/api";
import { recordPredecessorRead } from "@repo/backend/convex/contentRelease/predecessor/record";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  driftPredecessorRelease,
  PREDECESSOR_OBSERVATION_ID,
  readPredecessorRows,
  seedPredecessorObservation,
} from "@repo/backend/test/predecessor";
import { convexTest } from "convex-test";
import { Effect, Schema } from "effect";

const CURRENT_OBSERVATION_ID = "test-current-observation";
const rearm = internal.contentRelease.predecessor.rearm.rearm;

class TestMutationError extends Schema.TaggedError<TestMutationError>()(
  "TestMutationError",
  { cause: Schema.Unknown }
) {}

describe("contentRelease/predecessor/rearm/impl", () => {
  it.effect("rejects reuse of the previous observation identity", () =>
    Effect.gen(function* () {
      const target = convexTest(schema, convexModules);
      yield* Effect.promise(() => seedPredecessorObservation(target));

      const error = yield* Effect.tryPromise({
        try: () =>
          target.mutation(rearm, {
            observationId: PREDECESSOR_OBSERVATION_ID,
            previousObservationId: PREDECESSOR_OBSERVATION_ID,
          }),
        catch: (cause) => new TestMutationError({ cause }),
      }).pipe(Effect.flip);

      expect(error.cause).toMatchObject({
        data: { code: "CONTENT_RELEASE_STATE" },
      });
    })
  );

  it.effect(
    "atomically replaces unused evidence after active release drift",
    () =>
      Effect.gen(function* () {
        const target = convexTest(schema, convexModules);
        yield* Effect.promise(() => seedPredecessorObservation(target));
        yield* Effect.promise(() => driftPredecessorRelease(target));

        expect(
          yield* Effect.promise(() =>
            target.mutation(rearm, {
              observationId: CURRENT_OBSERVATION_ID,
              previousObservationId: PREDECESSOR_OBSERVATION_ID,
            })
          )
        ).toMatchObject({
          observationId: CURRENT_OBSERVATION_ID,
          routes: {
            batch: { invocationCount: 0 },
            history: { invocationCount: 0 },
            protected: { invocationCount: 0 },
            singular: { invocationCount: 0 },
          },
        });
        expect(
          yield* Effect.promise(() => readPredecessorRows(target))
        ).toMatchObject({
          batch: { observationId: CURRENT_OBSERVATION_ID },
          history: { observationId: CURRENT_OBSERVATION_ID },
          protected: { observationId: CURRENT_OBSERVATION_ID },
          singular: { observationId: CURRENT_OBSERVATION_ID },
        });
      })
  );

  it.effect("retains invoked evidence instead of resetting its counters", () =>
    Effect.gen(function* () {
      const target = convexTest(schema, convexModules);
      yield* Effect.promise(() => seedPredecessorObservation(target));
      yield* Effect.promise(() =>
        target.mutation((ctx) =>
          runConvexProgram(recordPredecessorRead(ctx, "protected"))
        )
      );
      yield* Effect.promise(() => driftPredecessorRelease(target));

      const error = yield* Effect.tryPromise({
        try: () =>
          target.mutation(rearm, {
            observationId: CURRENT_OBSERVATION_ID,
            previousObservationId: PREDECESSOR_OBSERVATION_ID,
          }),
        catch: (cause) => new TestMutationError({ cause }),
      }).pipe(Effect.flip);

      expect(error.cause).toMatchObject({
        data: { code: "CONTENT_RELEASE_STATE" },
      });
      expect(
        yield* Effect.promise(() => readPredecessorRows(target))
      ).toMatchObject({
        protected: {
          invocationCount: 1,
          observationId: PREDECESSOR_OBSERVATION_ID,
        },
      });
    })
  );
});
