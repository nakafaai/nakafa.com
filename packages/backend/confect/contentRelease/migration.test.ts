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
const WITNESS_HASH = `sha256:${"f".repeat(64)}`;
/** A stored artifact of the active release in the retired compiled-body format. */
const RETIRED_WITNESS = '{"payload":{"format":"mdx-function-body"}}';
/** A stored artifact of the active release in the current content-tree format. */
const CURRENT_WITNESS = '{"payload":{"format":"content-tree"}}';

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

/**
 * Stores one head of the active release. An upserted head names the witness
 * artifact, which is stored too unless the test leaves it missing.
 */
const seedHead = (head: {
  readonly artifactJson?: string;
  readonly operation: "delete" | "upsert";
}) =>
  Effect.gen(function* () {
    const t = yield* Confect;
    yield* t.run(
      Effect.gen(function* () {
        const ctx = yield* MutationCtx;
        yield* Effect.promise(async () => {
          await ctx.db.insert("contentHeads", {
            ...(head.operation === "upsert"
              ? { artifactHash: WITNESS_HASH }
              : {}),
            artifactLocale: "en",
            contentKey: "material:witness",
            family: "material",
            index: 0,
            operation: head.operation,
            releaseId: ACTIVE.releaseId,
            sequence: 1,
          });
          if (head.artifactJson !== undefined) {
            await ctx.db.insert("contentArtifacts", {
              artifactHash: WITNESS_HASH,
              artifactJson: head.artifactJson,
            });
          }
        });
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
      yield* seedState({ active: ACTIVE, generation: null, nextSequence: 2 });
      yield* seedHead({ artifactJson: RETIRED_WITNESS, operation: "upsert" });

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

  it.effect("refuses to record a generation its witness does not carry", () =>
    Effect.gen(function* () {
      const t = yield* Confect;
      yield* seedState({ active: ACTIVE, generation: null, nextSequence: 2 });
      yield* seedHead({ artifactJson: CURRENT_WITNESS, operation: "upsert" });

      expect(yield* t.mutation(markRetiredGeneration, {})).toEqual({
        outcome: "notRetired",
      });
      yield* checkState((state) =>
        expect(state).not.toHaveProperty("activeContentGeneration")
      );
    }).pipe(Effect.provide(confectLayer))
  );

  it.effect.each([
    {
      name: "the active release has no head",
      head: undefined,
    },
    {
      name: "the active release has no upserted head",
      head: { operation: "delete" as const },
    },
    {
      name: "the witness artifact is missing",
      head: { operation: "upsert" as const },
    },
  ])("refuses to record a generation when $name", ({ head }) =>
    Effect.gen(function* () {
      const t = yield* Confect;
      yield* seedState({ active: ACTIVE, generation: null, nextSequence: 2 });
      if (head) {
        yield* seedHead(head);
      }

      expect(yield* t.mutation(markRetiredGeneration, {})).toEqual({
        outcome: "unverifiable",
      });
      yield* checkState((state) =>
        expect(state).not.toHaveProperty("activeContentGeneration")
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
      yield* seedState({ generation: null, nextSequence: 1 });

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
