import { RegisteredConvexFunction } from "@confect/server";
import { assert, describe, expect, it } from "@effect/vitest";
import confectSchema from "@repo/backend/confect/_generated/schema";
import {
  activeSequence,
  finishBuild,
  isReady,
} from "@repo/backend/confect/contents/sections/state";
import { createConvexTestWithBetterAuth } from "@repo/backend/confect/test.helpers";
import { KNOWLEDGE_RELEASE, seedKnowledge } from "@repo/backend/test/knowledge";
import { Effect, Option } from "effect";

const MODEL = "google/gemini-embedding-2";
const ACTIVE = KNOWLEDGE_RELEASE.releaseId;

/** What a test does to the state of the index of one deployment. */
function against(t: ReturnType<typeof createConvexTestWithBetterAuth>) {
  /** Finishes the build and gives, with the answer, how many documents the transaction wrote. */
  const finishMeasured = (releaseId: string, model = MODEL) =>
    t.mutation(async (ctx) => {
      const result = await Effect.runPromise(
        finishBuild({ model, releaseId }).pipe(
          Effect.provide(
            RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
          )
        )
      );
      const metrics = await ctx.meta.getTransactionMetrics();
      return { documentsWritten: metrics.documentsWritten.used, result };
    });
  const finish = async (releaseId: string, model = MODEL) =>
    (await finishMeasured(releaseId, model)).result;
  /** Asks whether the index may answer and gives, with the answer, how many documents the transaction read. */
  const readyMeasured = (model = MODEL) =>
    t.mutation(async (ctx) => {
      const value = await Effect.runPromise(
        isReady(model).pipe(
          Effect.provide(
            RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
          )
        )
      );
      const metrics = await ctx.meta.getTransactionMetrics();
      return { documentsRead: metrics.documentsRead.used, value };
    });
  const ready = async (model = MODEL) => (await readyMeasured(model)).value;
  const sequence = (releaseId: string) =>
    t.mutation((ctx) =>
      Effect.runPromise(
        // A mutation returns Convex values, which an Option is not.
        Effect.map(activeSequence(releaseId), Option.getOrNull).pipe(
          Effect.provide(
            RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
          )
        )
      )
    );
  const records = () =>
    t.query((ctx) => ctx.db.query("contentSectionState").collect());
  /** Makes another release the active one, as an activation does. */
  const activate = (releaseId: string) =>
    t.mutation(async (ctx) => {
      const state = await ctx.db.query("contentState").unique();
      assert.ok(state, "Expected one active content state.");
      await ctx.db.patch("contentState", state._id, {
        activeReleaseId: releaseId,
      });
    });
  return {
    activate,
    finish,
    finishMeasured,
    ready,
    readyMeasured,
    records,
    sequence,
  };
}

/** A deployment whose active release is the one of the knowledge fixture. */
async function setup() {
  const t = createConvexTestWithBetterAuth();
  await t.mutation(seedKnowledge);
  return against(t);
}

describe("section index state", () => {
  it("gives the sequence of the active release, and none for any other release", async () => {
    const { sequence } = await setup();
    expect(await sequence(ACTIVE)).toBe(KNOWLEDGE_RELEASE.sequence);
    expect(await sequence("release-2")).toBeNull();
  });

  it("gives no sequence while no release is active", async () => {
    const { sequence } = against(createConvexTestWithBetterAuth());
    expect(await sequence(ACTIVE)).toBeNull();
  });

  it("is not ready before any build has finished", async () => {
    const { ready } = await setup();
    expect(await ready()).toBe(false);
  });

  it("is ready once the build of the active release has finished, for the model that embeds", async () => {
    const { finish, ready, records } = await setup();
    expect(await finish(ACTIVE)).toEqual({ recorded: true });
    expect(await records()).toMatchObject([
      { key: "primary", model: MODEL, releaseId: ACTIVE },
    ]);
    expect(await ready()).toBe(true);
  });

  it("reads the state of the content and the record of the build to tell, and nothing else", async () => {
    const { finish, readyMeasured } = await setup();
    await finish(ACTIVE);
    expect(await readyMeasured()).toEqual({ documentsRead: 2, value: true });
  });

  it("writes the record once, and not again when it says the same", async () => {
    const { finishMeasured, records } = await setup();
    // A rewrite of a record with the same words leaves it equal to what it
    // was, so only what the transaction wrote can tell the two apart.
    expect(await finishMeasured(ACTIVE)).toEqual({
      documentsWritten: 1,
      result: { recorded: true },
    });
    const [first] = await records();
    expect(await finishMeasured(ACTIVE)).toEqual({
      documentsWritten: 0,
      result: { recorded: true },
    });
    expect(await records()).toEqual([first]);
  });

  it("replaces the record when the model that embedded the index changed", async () => {
    const { finish, ready, records } = await setup();
    await finish(ACTIVE);
    await finish(ACTIVE, "qwen/qwen3-embedding-8b");
    expect(await records()).toMatchObject([
      { model: "qwen/qwen3-embedding-8b", releaseId: ACTIVE },
    ]);
    expect(await ready()).toBe(false);
  });

  it("is not ready for a model other than the one that embedded it", async () => {
    const { finish, ready } = await setup();
    await finish(ACTIVE);
    expect(await ready("qwen/qwen3-embedding-8b")).toBe(false);
  });

  it("is not ready once another release becomes active, and is again when that build has finished", async () => {
    const { activate, finish, ready, records } = await setup();
    await finish(ACTIVE);
    await activate("release-2");
    expect(await ready()).toBe(false);
    expect(await finish("release-2")).toEqual({ recorded: true });
    expect(await records()).toHaveLength(1);
    expect(await ready()).toBe(true);
  });

  it("records nothing for a release that is not the active one", async () => {
    const { activate, finish, ready, records } = await setup();
    await activate("release-2");
    expect(await finish(ACTIVE)).toEqual({ recorded: false });
    expect(await records()).toEqual([]);
    expect(await ready()).toBe(false);
  });

  it("is not ready while no release is active", async () => {
    const { ready } = against(createConvexTestWithBetterAuth());
    expect(await ready()).toBe(false);
  });
});
