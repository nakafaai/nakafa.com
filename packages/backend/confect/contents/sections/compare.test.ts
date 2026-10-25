import { RegisteredFunction } from "@confect/server";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import schema from "@repo/backend/confect/_generated/schema";
import { rankQuestions } from "@repo/backend/confect/contents/sections/compare";
import { COMPARE_PAGE_ROWS } from "@repo/backend/confect/contents/sections/limits";
import { Gateway } from "@repo/backend/confect/gateway/handle";
import { embeddingDimensions } from "@repo/backend/confect/gateway/model";
import { createConvexTestWithBetterAuth } from "@repo/backend/confect/test.helpers";
import type { ActionCtx } from "@repo/backend/convex/_generated/server";
import { makeMaterialProjection } from "@repo/backend/test/content/material";
import { GatewayTest, provider } from "@repo/backend/test/gateway";
import {
  embedWithKnowledge,
  knowledgeBuild,
  refusal,
  seedKnowledge,
} from "@repo/backend/test/knowledge";
import { APICallError } from "ai";
import { MockEmbeddingModelV4 } from "ai/test";
import { Array as Arr, Effect, Layer } from "effect";

beforeEach(() => vi.useFakeTimers());
afterEach(() => provider.embeddingModel.mockReset());

type Input = Parameters<typeof rankQuestions>[0];

const CANDIDATE = "qwen/qwen3-embedding-8b";
/** The first lesson of the fixture, whose Indonesian sections are: top, form, square form, determinant. */
const lesson = makeMaterialProjection("id", 1).contentKey;
/** The second lesson of the fixture, whose Indonesian sections are: top, formula, discriminant. */
const lessonTwo = makeMaterialProjection("id", 2).contentKey;

/** The test gateway, with an embedding that takes 30 milliseconds. */
const SlowGateway = Layer.effect(
  Gateway,
  Effect.map(Gateway, (gateway) =>
    Gateway.of({
      ...gateway,
      embed: (texts, model) =>
        Effect.delay(gateway.embed(texts, model), "30 millis"),
    })
  )
).pipe(Layer.provide(GatewayTest));

function setup(t: ReturnType<typeof createConvexTestWithBetterAuth>) {
  const layer = (ctx: ActionCtx) =>
    Layer.mergeAll(GatewayTest, RegisteredFunction.actionLayer(schema, ctx));
  const rank = (input: Omit<Input, "model">) =>
    t.action((ctx) =>
      Effect.runPromise(
        rankQuestions({ ...input, model: CANDIDATE }).pipe(
          Effect.provide(layer(ctx))
        )
      )
    );
  return { rank, t };
}

/** A deployment whose active release is indexed, with the embedder's record cleared. */
async function indexed() {
  const model = embedWithKnowledge();
  const t = createConvexTestWithBetterAuth();
  await t.mutation(seedKnowledge);
  await knowledgeBuild(t).build();
  model.doEmbedCalls.length = 0;
  return { model, ...setup(t) };
}

describe("model comparison", () => {
  it("ranks the section a question names among all stored sections of the language", async () => {
    const { rank } = await indexed();
    const result = await rank({
      locale: "id",
      questions: [
        {
          contentKey: lesson,
          ordinal: 3,
          question: "Bagaimana menghitung determinan matriks?",
        },
        {
          contentKey: lesson,
          ordinal: 0,
          question: "Matriks menyusun bilangan",
        },
      ],
    });
    expect(result).toMatchObject({
      kind: "ranked",
      pool: 9,
      verdicts: [
        { section: { heading: "Determinan", rank: 1 } },
        { section: { heading: "", rank: 1 } },
      ],
    });
  });

  it("ranks a section after the sections that are closer to the question", async () => {
    const { rank } = await indexed();
    // Only the section about the discriminant has anything to do with it.
    expect(
      await rank({
        locale: "id",
        questions: [
          { contentKey: lesson, ordinal: 1, question: "Apa itu diskriminan?" },
        ],
      })
    ).toMatchObject({
      verdicts: [{ section: { heading: "Bentuk Matriks", rank: 2 } }],
    });
  });

  it("leaves the verdict empty for a section that is not stored, and still answers the others", async () => {
    const { rank } = await indexed();
    const result = await rank({
      locale: "id",
      questions: [
        { contentKey: lesson, ordinal: 99, question: "Matriks" },
        { contentKey: "material/lesson/none", ordinal: 0, question: "Matriks" },
        { contentKey: lesson, ordinal: 1, question: "Matriks" },
      ],
    });
    expect(result).toMatchObject({
      verdicts: [
        { section: null },
        { section: null },
        { section: { heading: "Bentuk Matriks" } },
      ],
    });
  });

  it("leaves out a section whose text the candidate refuses, counts it, and ranks the question that names it last", async () => {
    const real = embedWithKnowledge();
    const { rank } = await indexed();
    // The candidate cannot take the text of one section, as a model with a
    // short input limit cannot take a long one.
    provider.embeddingModel.mockReturnValue(
      new MockEmbeddingModelV4({
        doEmbed: (options) =>
          Arr.some(options.values, (text) => text.includes("Diskriminan"))
            ? refusal()
            : real.doEmbed(options),
        maxEmbeddingsPerCall: 512,
      })
    );
    const result = await rank({
      locale: "id",
      questions: [
        {
          contentKey: lessonTwo,
          ordinal: 2,
          question: "Apa itu diskriminan?",
        },
        {
          contentKey: lesson,
          ordinal: 3,
          question: "Bagaimana menghitung determinan matriks?",
        },
      ],
    });
    expect(result).toMatchObject({
      kind: "ranked",
      pool: 8,
      refused: 1,
      verdicts: [
        { section: { heading: "Diskriminan", rank: 9 } },
        { section: { heading: "Determinan", rank: 1 } },
      ],
    });
  });

  it("embeds the stored sections of the language once and then each question, with the model it is given", async () => {
    const { model, rank } = await indexed();
    await rank({
      locale: "id",
      questions: [
        { contentKey: lesson, ordinal: 3, question: "Determinan" },
        { contentKey: lesson, ordinal: 1, question: "Matriks" },
      ],
    });
    expect(provider.embeddingModel).toHaveBeenCalledWith(CANDIDATE, {
      zdr: true,
    });
    // One request for each stored section, then one for each question.
    expect(Arr.map(model.doEmbedCalls, ({ values }) => values.length)).toEqual(
      Arr.makeBy(11, () => 1)
    );
    expect(model.doEmbedCalls[9]?.values).toEqual(["Determinan"]);
  });

  it("measures the time each question takes to embed", async () => {
    const { t } = await indexed();
    // Nothing is scheduled any more, so that the embedding can wait for real.
    vi.useRealTimers();
    const result = await t.action((ctx) =>
      Effect.runPromise(
        rankQuestions({
          locale: "id",
          model: CANDIDATE,
          questions: [
            { contentKey: lesson, ordinal: 3, question: "Determinan" },
            { contentKey: lesson, ordinal: 1, question: "Matriks" },
          ],
        }).pipe(
          Effect.provide(
            Layer.mergeAll(
              SlowGateway,
              RegisteredFunction.actionLayer(schema, ctx)
            )
          )
        )
      )
    );
    expect(result).toMatchObject({
      verdicts: [
        { milliseconds: expect.toSatisfy((ms: number) => ms >= 20) },
        { milliseconds: expect.toSatisfy((ms: number) => ms >= 20) },
      ],
    });
  });

  it("reads every page of the stored sections", async () => {
    embedWithKnowledge();
    const t = createConvexTestWithBetterAuth();
    const total = COMPARE_PAGE_ROWS + 6;
    await t.mutation(async (ctx) => {
      for (const ordinal of Arr.range(0, total - 1)) {
        await ctx.db.insert("contentSections", {
          anchor: `bagian-${ordinal}`,
          appLocale: "id",
          contentKey: "material/lesson/many",
          count: total,
          embedding: Arr.makeBy(embeddingDimensions, () => 0),
          excerpt: "Bagian.",
          hash: `sha256:${ordinal}`,
          headingPath: [`Bagian ${ordinal}`],
          model: "google/gemini-embedding-2",
          ordinal,
          publicPath: "materi/many",
          scope: "id:material",
          section: "material",
          text: `Matriks ${ordinal}`,
        });
      }
    });
    expect(
      await setup(t).rank({
        locale: "id",
        questions: [
          {
            contentKey: "material/lesson/many",
            ordinal: total - 1,
            question: "Matriks",
          },
        ],
      })
    ).toMatchObject({
      pool: total,
      verdicts: [{ section: { heading: `Bagian ${total - 1}` } }],
    });
  });

  it("says no section is stored for a language that has none", async () => {
    embedWithKnowledge();
    const t = createConvexTestWithBetterAuth();
    expect(
      await setup(t).rank({
        locale: "de",
        questions: [{ contentKey: lesson, ordinal: 0, question: "Matrix" }],
      })
    ).toEqual({ kind: "empty" });
    expect(provider.embeddingModel).not.toHaveBeenCalled();
  });

  it("fails with the failure of the embedder", async () => {
    const { rank } = await indexed();
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
      rank({
        locale: "id",
        questions: [{ contentKey: lesson, ordinal: 0, question: "Matriks" }],
      })
    ).rejects.toMatchObject({ reason: "invalid" });
  });
});
