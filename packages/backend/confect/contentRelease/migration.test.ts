import { describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { MutationCtx } from "@repo/backend/confect/_generated/services";
import {
  CURRENT_CONTENT_GENERATION,
  RETIRED_CONTENT_GENERATION,
} from "@repo/backend/confect/contentRelease/generation";
import { Confect, confectLayer } from "@repo/backend/confect/test.setup";
import { insertTestState } from "@repo/backend/test/content/state";
import { Effect } from "effect";

const markRetiredGeneration =
  refs.internal.contentRelease.migration.markRetiredGeneration;
const ACTIVE = {
  manifestHash: `sha256:${"e".repeat(64)}`,
  releaseId: "release-migrated-active",
  sequence: 1,
};

/** Replaces the publication pointer with exactly the given stored fields. */
const seedState = (options: Parameters<typeof insertTestState>[1]) =>
  Effect.gen(function* () {
    const t = yield* Confect;
    yield* t.run(
      Effect.gen(function* () {
        const ctx = yield* MutationCtx;
        yield* Effect.promise(() => insertTestState(ctx, options));
      })
    );
  });

/** Checks the stored publication pointer inside the test deployment, where it is readable. */
const checkState = (check: (state: unknown) => void) =>
  Effect.gen(function* () {
    const t = yield* Confect;
    yield* t.run(
      Effect.gen(function* () {
        const ctx = yield* MutationCtx;
        check(
          yield* Effect.promise(() => ctx.db.query("contentState").unique())
        );
      })
    );
  });

describe("contentRelease/migration", () => {
  it.effect("records the retired generation of the active release once", () =>
    Effect.gen(function* () {
      const t = yield* Confect;
      yield* seedState({ active: ACTIVE, nextSequence: 2 });

      expect(yield* t.mutation(markRetiredGeneration, {})).toEqual({
        outcome: "marked",
      });
      expect(yield* t.mutation(markRetiredGeneration, {})).toEqual({
        outcome: "alreadyRecorded",
      });
      yield* checkState((state) =>
        expect(state).toMatchObject({
          activeContentGeneration: RETIRED_CONTENT_GENERATION,
          activeReleaseId: ACTIVE.releaseId,
          nextSequence: 2,
        })
      );
    }).pipe(Effect.provide(confectLayer))
  );

  it.effect("keeps a generation that is already recorded", () =>
    Effect.gen(function* () {
      const t = yield* Confect;
      yield* seedState({
        active: ACTIVE,
        generation: CURRENT_CONTENT_GENERATION,
        nextSequence: 2,
      });

      expect(yield* t.mutation(markRetiredGeneration, {})).toEqual({
        outcome: "alreadyRecorded",
      });
      yield* checkState((state) =>
        expect(state).toMatchObject({
          activeContentGeneration: CURRENT_CONTENT_GENERATION,
        })
      );
    }).pipe(Effect.provide(confectLayer))
  );

  it.effect("marks nothing without an active release", () =>
    Effect.gen(function* () {
      const t = yield* Confect;
      yield* seedState({ nextSequence: 1 });

      expect(yield* t.mutation(markRetiredGeneration, {})).toEqual({
        outcome: "noActiveRelease",
      });
      yield* checkState((state) =>
        expect(state).not.toHaveProperty("activeContentGeneration")
      );
    }).pipe(Effect.provide(confectLayer))
  );

  it.effect("marks nothing without a publication state", () =>
    Effect.gen(function* () {
      const t = yield* Confect;

      expect(yield* t.mutation(markRetiredGeneration, {})).toEqual({
        outcome: "noActiveRelease",
      });
      yield* checkState((state) => expect(state).toBeNull());
    }).pipe(Effect.provide(confectLayer))
  );
});
