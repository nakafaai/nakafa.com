import { RegisteredConvexFunction } from "@confect/server";
import { assert, describe, expect, it } from "@effect/vitest";
import confectSchema from "@repo/backend/confect/_generated/schema";
import {
  finishBuild,
  isReady,
} from "@repo/backend/confect/contents/sections/state";
import { createConvexTestWithBetterAuth } from "@repo/backend/confect/test.helpers";
import { KNOWLEDGE_RELEASE, seedKnowledge } from "@repo/backend/test/knowledge";
import { Effect } from "effect";

const MODEL = "google/gemini-embedding-2";
const ACTIVE = KNOWLEDGE_RELEASE.releaseId;

/** What a test does to the state of the index of one deployment. */
function against(t: ReturnType<typeof createConvexTestWithBetterAuth>) {
  const finish = (releaseId: string) =>
    t.mutation((ctx) =>
      Effect.runPromise(
        finishBuild({ model: MODEL, releaseId }).pipe(
          Effect.provide(
            RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
          )
        )
      )
    );
  const ready = (model = MODEL) =>
    t.mutation((ctx) =>
      Effect.runPromise(
        isReady(model).pipe(
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
  return { activate, finish, ready, records };
}

/** A deployment whose active release is the one of the knowledge fixture. */
async function setup() {
  const t = createConvexTestWithBetterAuth();
  await t.mutation(seedKnowledge);
  return against(t);
}

describe("section index state", () => {
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
