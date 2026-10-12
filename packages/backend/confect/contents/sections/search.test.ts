import { RegisteredFunction } from "@confect/server";
import {
  afterEach,
  assert,
  beforeEach,
  describe,
  expect,
  it,
} from "@effect/vitest";
import schema from "@repo/backend/confect/_generated/schema";
import { searchSections } from "@repo/backend/confect/contents/sections/search";
import { createConvexTestWithBetterAuth } from "@repo/backend/confect/test.helpers";
import type {
  ActionCtx,
  MutationCtx,
} from "@repo/backend/convex/_generated/server";
import { GatewayTest, provider } from "@repo/backend/test/gateway";
import {
  embedWithKnowledge,
  knowledgeBuild,
  seedKnowledge,
} from "@repo/backend/test/knowledge";
import { APICallError } from "ai";
import { MockEmbeddingModelV4 } from "ai/test";
import { Array as Arr, Effect, Layer } from "effect";

beforeEach(() => vi.useFakeTimers());
afterEach(() => provider.embeddingModel.mockReset());

type Input = Parameters<typeof searchSections>[0];

/**
 * A deployment whose active release is indexed, searchable by its concept
 * embedder, whose record of the texts it embedded is cleared.
 */
async function indexed() {
  const model = embedWithKnowledge();
  const t = createConvexTestWithBetterAuth();
  await t.mutation(seedKnowledge);
  await knowledgeBuild(t).build();
  model.doEmbedCalls.length = 0;
  return { model, ...setup(t) };
}

function setup(t: ReturnType<typeof createConvexTestWithBetterAuth>) {
  const layer = (ctx: ActionCtx) =>
    Layer.mergeAll(GatewayTest, RegisteredFunction.actionLayer(schema, ctx));
  const search = (input: Input) =>
    t.action((ctx) =>
      Effect.runPromise(searchSections(input).pipe(Effect.provide(layer(ctx))))
    );
  const hits = async (input: Input) => {
    const result = await search(input);
    if (result.kind !== "hits") {
      throw new Error("Expected the index to hold sections.");
    }
    return result.hits;
  };
  const places = async (input: Input) =>
    Arr.map(
      await hits(input),
      ({ anchor, appLocale }) => `${appLocale}:${anchor}`
    );
  return { hits, places, search, t };
}

describe("section search", () => {
  it("finds the section a question asks about, whatever the language of the question", async () => {
    const { places } = await indexed();
    expect(
      await places({
        limit: 3,
        locale: "id",
        query: "Wie berechne ich die Determinante einer Matrix?",
      })
    ).toEqual(expect.arrayContaining(["id:determinan"]));
    expect(
      (
        await places({
          limit: 1,
          locale: "id",
          query: "Wie berechne ich die Determinante einer Matrix?",
        })
      )[0]
    ).toBe("id:determinan");
  });

  it("finds the section that holds the words of a question", async () => {
    const { places } = await indexed();
    // No meaning of the test embedder is in this word, only the words match.
    expect(
      (await places({ limit: 1, locale: "id", query: "dikurangi" }))[0]
    ).toBe("id:determinan");
  });

  it("returns every section in the language of the learner", async () => {
    const { places } = await indexed();
    expect(
      await places({ limit: 1, locale: "de", query: "discriminant" })
    ).toEqual(["de:diskriminante"]);
  });

  it("searches one kind of content when asked", async () => {
    const { hits } = await indexed();
    const found = await hits({
      locale: "id",
      query: "politik",
      section: "articles",
    });
    expect(found.length).toBeGreaterThan(0);
    expect(
      Arr.every(found, ({ reference }) => reference.section === "articles")
    ).toBe(true);
  });

  it("returns the verified reference of each section's document, with at most the limit", async () => {
    const { hits } = await indexed();
    const found = await hits({ limit: 2, locale: "id", query: "matriks" });
    expect(found).toHaveLength(2);
    expect(found[0]).toMatchObject({
      appLocale: "id",
      contentKey: expect.stringContaining("material/lesson"),
      excerpt: expect.any(String),
      reference: { locale: "id", section: "material", title: "ID Section 1" },
    });
  });

  it("asks for a question with no usable word by its meaning alone", async () => {
    const { places } = await indexed();
    expect((await places({ limit: 1, locale: "id", query: "?!" })).length).toBe(
      1
    );
  });

  it("says the index is empty, and does not embed the question, when it holds no section", async () => {
    const model = embedWithKnowledge();
    const t = createConvexTestWithBetterAuth();
    await t.mutation(seedKnowledge);
    expect(
      await setup(t).search({ locale: "id", query: "determinan" })
    ).toEqual({ kind: "empty" });
    expect(model.doEmbedCalls).toHaveLength(0);
  });

  it("says the index is empty, and does not embed the question, while the build of the active release has not finished", async () => {
    const model = embedWithKnowledge();
    const t = createConvexTestWithBetterAuth();
    await t.mutation(seedKnowledge);
    // One step stores the German and English lessons, but the build ends with
    // the steps that follow.
    await knowledgeBuild(t).run();
    expect(
      await t.query((ctx) =>
        ctx.db
          .query("contentSections")
          .filter((q) => q.eq(q.field("appLocale"), "de"))
          .first()
      )
    ).not.toBeNull();
    model.doEmbedCalls.length = 0;
    expect(
      await setup(t).search({ locale: "de", query: "Determinante" })
    ).toEqual({ kind: "empty" });
    expect(model.doEmbedCalls).toHaveLength(0);
  });

  it.each([
    [
      "the record of the finished build is gone",
      async (ctx: MutationCtx) => {
        for (const record of await ctx.db
          .query("contentSectionState")
          .collect()) {
          await ctx.db.delete("contentSectionState", record._id);
        }
      },
    ],
    [
      "a release that was built is no longer the active one",
      async (ctx: MutationCtx) => {
        const state = await ctx.db.query("contentState").unique();
        assert.ok(state, "Expected one active content state.");
        await ctx.db.patch("contentState", state._id, {
          activeReleaseId: "release-later",
        });
      },
    ],
    [
      "the model that embeds the questions is not the one that embedded the sections",
      async (ctx: MutationCtx) => {
        for (const record of await ctx.db
          .query("contentSectionState")
          .collect()) {
          await ctx.db.patch("contentSectionState", record._id, {
            model: "qwen/qwen3-embedding-8b",
          });
        }
      },
    ],
  ])(
    "says the index is empty, and does not embed the question, once %s",
    async (_reason, change) => {
      const { model, search, t } = await indexed();
      await t.mutation(change);
      expect(await search({ locale: "id", query: "determinan" })).toEqual({
        kind: "empty",
      });
      expect(model.doEmbedCalls).toHaveLength(0);
    }
  );

  it("fails with the failure of the embedder", async () => {
    const { t } = await indexed();
    provider.embeddingModel.mockReturnValue(
      new MockEmbeddingModelV4({
        doEmbed: () =>
          Promise.reject(
            new APICallError({
              message: "private provider response",
              requestBodyValues: {},
              statusCode: 400,
              url: "https://provider.example.invalid",
            })
          ),
      })
    );
    await expect(
      setup(t).search({ locale: "id", query: "determinan" })
    ).rejects.toMatchObject({ reason: "invalid" });
  });

  it("gives up after its deadline so a caller can fall back", async () => {
    const { t } = await indexed();
    provider.embeddingModel.mockReturnValue(
      new MockEmbeddingModelV4({ doEmbed: () => new Promise(() => undefined) })
    );
    const pending = setup(t)
      .search({ locale: "id", query: "determinan" })
      .catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(await pending).toMatchObject({ reason: "timeout" });
  });
});
