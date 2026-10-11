import { RegisteredFunction } from "@confect/server";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import schema from "@repo/backend/confect/_generated/schema";
import { searchSections } from "@repo/backend/confect/contents/sections/search";
import { createConvexTestWithBetterAuth } from "@repo/backend/confect/test.helpers";
import type { ActionCtx } from "@repo/backend/convex/_generated/server";
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

/** A deployment whose active release is indexed, searchable by its concept embedder. */
async function indexed() {
  embedWithKnowledge();
  const t = createConvexTestWithBetterAuth();
  await t.mutation(seedKnowledge);
  await knowledgeBuild(t).build();
  return setup(t);
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

  it("says the index is empty when it holds no section", async () => {
    embedWithKnowledge();
    const t = createConvexTestWithBetterAuth();
    await t.mutation(seedKnowledge);
    expect(
      await setup(t).search({ locale: "id", query: "determinan" })
    ).toEqual({ kind: "empty" });
  });

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
