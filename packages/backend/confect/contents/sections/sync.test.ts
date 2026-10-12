import { RegisteredFunction } from "@confect/server";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import confectSchema from "@repo/backend/confect/_generated/schema";
import { documentSections } from "@repo/backend/confect/contents/sections/draft";
import { SECTIONS_PER_CHECK } from "@repo/backend/confect/contents/sections/limits";
import {
  knownInputValidator,
  type SectionDocument,
} from "@repo/backend/confect/contents/sections/schema";
import { syncDocuments } from "@repo/backend/confect/contents/sections/sync";
import { embeddingDimensions } from "@repo/backend/confect/gateway/model";
import { createConvexTestWithBetterAuth } from "@repo/backend/confect/test.helpers";
import type { ActionCtx } from "@repo/backend/convex/_generated/server";
import { GatewayTest, provider } from "@repo/backend/test/gateway";
import {
  embedWithKnowledge,
  embedWithRefusal,
  KNOWLEDGE_RELEASE,
  refusal,
  seedKnowledge,
} from "@repo/backend/test/knowledge";
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

/** The document of a lesson with that many headings, each with a body that `textOf` gives. */
function lesson(
  headings: number,
  textOf: TextOf = (number) => `Bagian ${number} menyusun bilangan.`,
  options: { contentKey?: string; version?: string } = {}
): SectionDocument {
  const contentKey = options.contentKey ?? source.contentKey;
  return {
    appLocale: source.appLocale,
    contentKey,
    section: source.section,
    sections: documentSections(
      { ...source, contentKey },
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
    ),
    version: options.version ?? "first",
  };
}

/** A deployment whose active release is the one of the knowledge fixture. */
async function setup() {
  const t = createConvexTestWithBetterAuth();
  await t.mutation(seedKnowledge);
  const layer = (ctx: ActionCtx) =>
    Layer.mergeAll(
      GatewayTest,
      RegisteredFunction.actionLayer(confectSchema, ctx)
    );
  const sync = (
    documents: readonly SectionDocument[],
    releaseId: string = KNOWLEDGE_RELEASE.releaseId
  ) =>
    t.action((ctx) =>
      Effect.runPromise(
        syncDocuments(releaseId, documents).pipe(Effect.provide(layer(ctx)))
      )
    );
  /** Syncs the documents and gives each query that the sync ran, by function name and arguments. */
  const syncObserved = (documents: readonly SectionDocument[]) =>
    t.action(async (ctx) => {
      const spy = vi.spyOn(ctx, "runQuery");
      await Effect.runPromise(
        syncDocuments(KNOWLEDGE_RELEASE.releaseId, documents).pipe(
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
  const sources = () =>
    t.query((ctx) => ctx.db.query("contentSectionSources").collect());
  return { rows, sources, sync, syncObserved };
}

describe("section sync", () => {
  it("embeds and stores the sections that the index lacks, and records the version they were made from", async () => {
    const model = embedWithKnowledge();
    const { rows, sources, sync } = await setup();
    expect(await sync([lesson(3)])).toEqual({
      embedded: 3,
      kept: 0,
      missing: 0,
      removed: 0,
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
    expect(await sources()).toMatchObject([
      { contentKey: source.contentKey, version: "first" },
    ]);
  });

  it("embeds the sections of several documents together and stores each document with its own version", async () => {
    const model = embedWithKnowledge();
    const { rows, sources, sync } = await setup();
    expect(
      await sync([
        lesson(3),
        lesson(2, undefined, {
          contentKey: "material/lesson/lain",
          version: "x",
        }),
      ])
    ).toMatchObject({ embedded: 5, written: 5 });
    expect(model.doEmbedCalls).toHaveLength(1);
    expect(await rows()).toHaveLength(5);
    expect(
      Arr.map(await sources(), ({ contentKey, version }) => [
        contentKey,
        version,
      ])
    ).toEqual([
      ["material/lesson/matematika/matriks", "first"],
      ["material/lesson/lain", "x"],
    ]);
  });

  it("does not send a section to the embedder a second time, nor write it again", async () => {
    const model = embedWithKnowledge();
    const { rows, sync } = await setup();
    await sync([lesson(3)]);
    const before = await rows();
    model.doEmbedCalls.length = 0;
    expect(await sync([lesson(3)])).toEqual({
      embedded: 0,
      kept: 3,
      missing: 0,
      removed: 0,
      stale: false,
      written: 0,
    });
    expect(model.doEmbedCalls).toHaveLength(0);
    expect(await rows()).toEqual(before);
  });

  it("embeds only the section whose text changed", async () => {
    const model = embedWithKnowledge();
    const { sync } = await setup();
    await sync([lesson(3, () => "Sama.")]);
    model.doEmbedCalls.length = 0;
    expect(
      await sync([
        lesson(3, (number) => (number === 2 ? "Teks baru." : "Sama."), {
          version: "second",
        }),
      ])
    ).toMatchObject({ embedded: 1, kept: 2, written: 1 });
    expect(Arr.flatMap(model.doEmbedCalls, ({ values }) => values)).toEqual([
      expect.stringContaining("Teks baru."),
    ]);
  });

  it("removes the rows of the sections that a document lost, and keeps the vectors of the others", async () => {
    const model = embedWithKnowledge();
    const { rows, sync } = await setup();
    await sync([lesson(4)]);
    model.doEmbedCalls.length = 0;
    // The sections that stay have fewer companions now, which their rows say.
    expect(await sync([lesson(2, undefined, { version: "second" })])).toEqual({
      embedded: 0,
      kept: 0,
      missing: 0,
      removed: 2,
      stale: false,
      written: 2,
    });
    expect(model.doEmbedCalls).toHaveLength(0);
    expect(await rows()).toHaveLength(2);
  });

  it("leaves out a section whose text the model refuses, and counts it as missing", async () => {
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
      await sync([
        lesson(3, (number) => (number === 2 ? "Terlarang." : "Aman.")),
      ])
    ).toEqual({
      embedded: 2,
      kept: 0,
      missing: 1,
      removed: 0,
      stale: false,
      written: 2,
    });
    expect(Arr.map(await rows(), ({ anchor }) => anchor)).toEqual(
      expect.not.arrayContaining(["bagian-2"])
    );
    expect(await rows()).toHaveLength(2);
  });

  it("fails with the failure of the embedder when the model refuses every section, and stores nothing", async () => {
    embedWithRefusal();
    const { rows, sources, sync } = await setup();
    await expect(sync([lesson(3)])).rejects.toMatchObject({
      reason: "invalid",
    });
    expect(await rows()).toEqual([]);
    expect(await sources()).toEqual([]);
  });

  it("stores nothing for a release that is not the active one", async () => {
    embedWithKnowledge();
    const { rows, sources, sync } = await setup();
    expect(await sync([lesson(2)], "release-earlier")).toMatchObject({
      stale: true,
      written: 0,
    });
    expect(await rows()).toEqual([]);
    expect(await sources()).toEqual([]);
  });

  it("asks what the index holds a bounded group of sections at a time, with the key of each", async () => {
    embedWithKnowledge();
    const { syncObserved } = await setup();
    const headings = 150;
    const queries = await syncObserved([lesson(headings)]);
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
