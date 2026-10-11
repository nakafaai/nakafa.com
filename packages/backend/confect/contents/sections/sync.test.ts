import { RegisteredFunction } from "@confect/server";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import confectSchema from "@repo/backend/confect/_generated/schema";
import { documentSections } from "@repo/backend/confect/contents/sections/draft";
import { SECTIONS_PER_CHECK } from "@repo/backend/confect/contents/sections/limits";
import {
  knownInputValidator,
  type SectionFields,
} from "@repo/backend/confect/contents/sections/schema";
import { syncSections } from "@repo/backend/confect/contents/sections/sync";
import { embeddingDimensions } from "@repo/backend/confect/gateway/model";
import { createConvexTestWithBetterAuth } from "@repo/backend/confect/test.helpers";
import type { ActionCtx } from "@repo/backend/convex/_generated/server";
import { GatewayTest, provider } from "@repo/backend/test/gateway";
import {
  embedWithKnowledge,
  KNOWLEDGE_RELEASE,
  seedKnowledge,
} from "@repo/backend/test/knowledge";
import { APICallError } from "ai";
import { MockEmbeddingModelV4 } from "ai/test";
import { getFunctionName } from "convex/server";
import { Array as Arr, Effect, Layer, Schema } from "effect";

beforeEach(() => vi.useFakeTimers());
afterEach(() => provider.embeddingModel.mockReset());

const source = {
  appLocale: "id",
  contentKey: "material/lesson/matematika/matriks",
  publicPath: "materi/matematika/matriks",
  section: "material",
} as const;

/** The text of the section with that number, which a test may change. */
type TextOf = (number: number) => string;

/** The sections of a lesson with that many headings, each with a body that `textOf` gives. */
function lesson(
  headings: number,
  textOf: TextOf = (number) => `Bagian ${number} menyusun bilangan.`
): SectionFields[] {
  return documentSections(
    source,
    "Matriks",
    Arr.join(
      [
        "# Matriks",
        ...Arr.flatMap(Arr.range(1, headings), (number) => [
          "",
          `## Bagian ${number}`,
          "",
          textOf(number),
        ]),
      ],
      "\n"
    )
  );
}

const refusal = () =>
  Promise.reject(
    new APICallError({
      message: "private provider response",
      requestBodyValues: {},
      statusCode: 400,
      url: "https://provider.example.invalid",
    })
  );

/** A deployment whose active release is the one of the knowledge fixture. */
async function setup() {
  const t = createConvexTestWithBetterAuth();
  await t.mutation(seedKnowledge);
  const layer = (ctx: ActionCtx) =>
    Layer.mergeAll(
      GatewayTest,
      RegisteredFunction.actionLayer(confectSchema, ctx)
    );
  const sync = (sections: readonly SectionFields[]) =>
    t.action((ctx) =>
      Effect.runPromise(
        syncSections(KNOWLEDGE_RELEASE.releaseId, sections).pipe(
          Effect.provide(layer(ctx))
        )
      )
    );
  /** Syncs the sections and gives each query that the sync ran, by function name and arguments. */
  const syncObserved = (sections: readonly SectionFields[]) =>
    t.action(async (ctx) => {
      const spy = vi.spyOn(ctx, "runQuery");
      await Effect.runPromise(
        syncSections(KNOWLEDGE_RELEASE.releaseId, sections).pipe(
          Effect.provide(layer(ctx))
        )
      );
      return Arr.map(spy.mock.calls, ([query, args]) => ({
        args,
        name: getFunctionName(query),
      }));
    });
  const rows = () =>
    t.query((ctx) => ctx.db.query("contentSections").collect());
  return { rows, sync, syncObserved };
}

describe("section sync", () => {
  it("embeds and stores the sections that the index lacks", async () => {
    const model = embedWithKnowledge();
    const { rows, sync } = await setup();
    expect(await sync(lesson(3))).toEqual({
      embedded: 3,
      kept: 0,
      missing: 0,
      stale: false,
      written: 3,
    });
    expect(
      Arr.flatMap(model.doEmbedCalls, ({ values }) => values)
    ).toHaveLength(3);
    const stored = await rows();
    expect(stored).toHaveLength(3);
    expect(
      Arr.every(stored, (row) => row.embedding.length === embeddingDimensions)
    ).toBe(true);
  });

  it("does not send a section to the embedder a second time", async () => {
    const model = embedWithKnowledge();
    const { sync } = await setup();
    await sync(lesson(3));
    model.doEmbedCalls.length = 0;
    expect(await sync(lesson(3))).toEqual({
      embedded: 0,
      kept: 3,
      missing: 0,
      stale: false,
      written: 0,
    });
    expect(model.doEmbedCalls).toHaveLength(0);
  });

  it("embeds only the section whose text changed", async () => {
    const model = embedWithKnowledge();
    const { sync } = await setup();
    await sync(lesson(3, () => "Sama."));
    model.doEmbedCalls.length = 0;
    expect(
      await sync(lesson(3, (number) => (number === 2 ? "Teks baru." : "Sama.")))
    ).toMatchObject({ embedded: 1, kept: 2, written: 1 });
    expect(Arr.flatMap(model.doEmbedCalls, ({ values }) => values)).toEqual([
      expect.stringContaining("Teks baru."),
    ]);
  });

  it("stores a section whose text the model refuses without a vector, and counts it as missing", async () => {
    const real = embedWithKnowledge();
    provider.embeddingModel.mockReturnValue(
      new MockEmbeddingModelV4({
        doEmbed: (options) =>
          Arr.some(options.values, (text) => text.includes("Terlarang"))
            ? refusal()
            : real.doEmbed(options),
        maxEmbeddingsPerCall: 512,
      })
    );
    const { rows, sync } = await setup();
    expect(
      await sync(lesson(3, (number) => (number === 2 ? "Terlarang." : "Aman.")))
    ).toEqual({
      embedded: 2,
      kept: 0,
      missing: 1,
      stale: false,
      written: 2,
    });
    expect(Arr.map(await rows(), ({ anchor }) => anchor)).toEqual(
      expect.not.arrayContaining(["bagian-2"])
    );
    expect(await rows()).toHaveLength(2);
  });

  it("fails with the failure of the embedder when the model refuses every section, and stores nothing", async () => {
    provider.embeddingModel.mockReturnValue(
      new MockEmbeddingModelV4({ doEmbed: refusal })
    );
    const { rows, sync } = await setup();
    await expect(sync(lesson(3))).rejects.toMatchObject({ reason: "invalid" });
    expect(await rows()).toEqual([]);
  });

  it("asks what the index holds a bounded group of sections at a time, with the key of each", async () => {
    embedWithKnowledge();
    const { syncObserved } = await setup();
    const headings = 150;
    const queries = await syncObserved(lesson(headings));
    // Parsing refuses a section with more than its key, so the texts are not sent.
    const checks = Arr.map(
      Arr.filter(
        queries,
        ({ name }) => name === "contents/sections/rows:stored"
      ),
      ({ args }) =>
        Schema.decodeUnknownSync(knownInputValidator)(args, {
          onExcessProperty: "error",
        })
    );
    expect(Arr.map(checks, ({ sections }) => sections.length)).toEqual([
      SECTIONS_PER_CHECK,
      SECTIONS_PER_CHECK,
      headings - 2 * SECTIONS_PER_CHECK,
    ]);
  });
});
