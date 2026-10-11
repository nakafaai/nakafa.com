import {
  afterEach,
  assert,
  beforeEach,
  describe,
  expect,
  it,
} from "@effect/vitest";
import type { runStep } from "@repo/backend/confect/contents/sections/build";
import { EMBED_BATCH_SIZE } from "@repo/backend/confect/contents/sections/limits";
import { embeddingDimensions } from "@repo/backend/confect/gateway/model";
import { createConvexTestWithBetterAuth } from "@repo/backend/confect/test.helpers";
import { TEST_RELEASE_ID } from "@repo/backend/test/content/release";
import { provider } from "@repo/backend/test/gateway";
import {
  editKnowledgeLesson,
  embedWithKnowledge,
  KNOWLEDGE_RELEASE,
  knowledgeBuild,
  seedKnowledge,
} from "@repo/backend/test/knowledge";
import { makeQuranChunk, makeQuranSurah } from "@repo/backend/test/quran/rows";
import {
  activateQuranSnapshot,
  activateQuranSource,
} from "@repo/backend/test/quran/snapshot";
import { APICallError } from "ai";
import { MockEmbeddingModelV4 } from "ai/test";
import { Array as Arr, Number as Num, Order } from "effect";

beforeEach(() => vi.useFakeTimers());
afterEach(() => provider.embeddingModel.mockReset());

type Input = Parameters<typeof runStep>[0];

function setup() {
  const t = createConvexTestWithBetterAuth();
  const rows = () =>
    t.query((ctx) => ctx.db.query("contentSections").collect());
  return { ...knowledgeBuild(t), rows, t };
}

/** The texts that the steps sent to the embedder. */
const embeddedBy = (
  steps: Awaited<ReturnType<ReturnType<typeof setup>["build"]>>
) => Num.sumAll(Arr.map(steps, ({ embedded }) => embedded));

/**
 * Embeds like a gateway that is slow enough for another release to become the
 * active one while a step waits for its vectors.
 */
function embedWhileAnotherReleaseActivates(
  t: ReturnType<typeof createConvexTestWithBetterAuth>
) {
  provider.embeddingModel.mockReturnValue(
    new MockEmbeddingModelV4({
      doEmbed: async ({ values }) => {
        await t.mutation(async (ctx) => {
          const state = await ctx.db.query("contentState").unique();
          assert.ok(state, "Expected one active content state.");
          await ctx.db.patch("contentState", state._id, {
            activeReleaseId: "release-later",
          });
        });
        return {
          embeddings: Arr.map(values, () =>
            Arr.makeBy(embeddingDimensions, () => 0)
          ),
          warnings: [],
        };
      },
    })
  );
}

describe("section build", () => {
  it("indexes the active release: its lessons, then its Quran, then a clean up", async () => {
    const model = embedWithKnowledge();
    const { build, rows, t } = setup();
    await t.mutation(seedKnowledge);
    const steps = await build();
    expect(Arr.map(steps, ({ position }) => position.phase)).toEqual([
      "lessons",
      "lessons",
      "quran",
      "prune",
    ]);
    expect(embeddedBy(steps)).toBe(27);
    expect(
      Arr.flatMap(model.doEmbedCalls, ({ values }) => values)
    ).toHaveLength(27);
    const stored = await rows();
    expect(stored).toHaveLength(27);
    expect(
      Arr.every(stored, (row) => row.embedding.length === embeddingDimensions)
    ).toBe(true);
    expect(
      Arr.every(stored, (row) => row.releaseId === KNOWLEDGE_RELEASE.releaseId)
    ).toBe(true);
    expect(
      Arr.map(
        Arr.filter(
          stored,
          ({ appLocale, contentKey }) =>
            appLocale === "id" && contentKey.endsWith("section-1")
        ),
        ({ anchor, headingPath, ordinal, scope }) => ({
          anchor,
          headingPath,
          ordinal,
          scope,
        })
      )
    ).toEqual(
      expect.arrayContaining([
        {
          anchor: "bentuk-matriks",
          headingPath: ["Bentuk Matriks"],
          ordinal: 1,
          scope: ["id", "material"],
        },
        {
          anchor: "matriks-persegi",
          headingPath: ["Bentuk Matriks", "Matriks Persegi"],
          ordinal: 2,
          scope: ["id", "material"],
        },
      ])
    );
  });

  it("schedules the step that follows a step", async () => {
    embedWithKnowledge();
    const { run, t } = setup();
    await t.mutation(seedKnowledge);
    const first = await run();
    const jobs = await t.run((ctx) =>
      ctx.db.system.query("_scheduled_functions").collect()
    );
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({
      args: [first.next],
      name: "contents/sections/build:run",
    });
  });

  it("embeds nothing a second time", async () => {
    const model = embedWithKnowledge();
    const { build, rows, t } = setup();
    await t.mutation(seedKnowledge);
    await build();
    const before = await rows();
    model.doEmbedCalls.length = 0;
    const again = await build();
    expect(embeddedBy(again)).toBe(0);
    expect(model.doEmbedCalls).toHaveLength(0);
    expect(await rows()).toEqual(before);
  });

  it("embeds only the sections that changed and removes those that vanished", async () => {
    const model = embedWithKnowledge();
    const { build, rows, t } = setup();
    await t.mutation(seedKnowledge);
    await build();
    await t.mutation(async (ctx) => {
      // The index was built for an earlier release. In the active release one
      // section of the Indonesian lesson is gone, and a lesson that no release
      // holds any more still has a row.
      for (const row of await ctx.db.query("contentSections").collect()) {
        await ctx.db.patch("contentSections", row._id, {
          releaseId: "release-earlier",
        });
      }
      await editKnowledgeLesson(
        ctx,
        1,
        "id",
        Arr.join(
          [
            "Matriks menyusun bilangan.",
            "## Bentuk Matriks",
            "Matriks menyusun bilangan dalam baris dan kolom.",
            "## Determinan",
            "Determinan matriks dua kali dua adalah ad dikurangi bc.",
          ],
          "\n\n"
        )
      );
      const [row] = await ctx.db.query("contentSections").take(1);
      if (!row) {
        throw new Error("Expected a stored section.");
      }
      const { _creationTime, _id, ...fields } = row;
      await ctx.db.insert("contentSections", {
        ...fields,
        contentKey: "material/lesson/removed",
        releaseId: "release-earlier",
      });
    });
    model.doEmbedCalls.length = 0;
    const steps = await build();
    expect(embeddedBy(steps)).toBe(1);
    expect(Arr.flatMap(model.doEmbedCalls, ({ values }) => values)).toEqual([
      expect.stringContaining("Determinan matriks dua kali dua"),
    ]);
    const stored = await rows();
    expect(stored).toHaveLength(26);
    expect(
      Arr.sort(
        Arr.map(
          Arr.filter(
            stored,
            ({ appLocale, contentKey }) =>
              appLocale === "id" && contentKey.endsWith("section-1")
          ),
          ({ anchor, count, ordinal }) => `${ordinal}/${count} ${anchor}`
        ),
        Order.String
      )
    ).toEqual(["0/3 top", "1/3 bentuk-matriks", "2/3 determinan"]);
    expect(
      Arr.some(
        stored,
        ({ contentKey }) => contentKey === "material/lesson/removed"
      )
    ).toBe(false);
  });

  it("skips a lesson whose source cannot be split and indexes the others", async () => {
    embedWithKnowledge();
    const { build, rows, t } = setup();
    await t.mutation(async (ctx) => {
      await seedKnowledge(ctx);
      await editKnowledgeLesson(ctx, 1, "id", "<Broken");
    });
    const steps = await build();
    expect(embeddedBy(steps)).toBe(23);
    expect(await rows()).toHaveLength(23);
  });

  it("stops without a trace when the release changed under the build", async () => {
    const model = embedWithKnowledge();
    const { run, t } = setup();
    await t.mutation(seedKnowledge);
    for (const input of [
      { releaseId: "release-earlier" },
      { position: { phase: "quran", surah: 1 }, releaseId: "release-earlier" },
      { position: { phase: "prune" } },
    ] satisfies Input[]) {
      expect(await run(input)).toMatchObject({ next: null, stale: true });
    }
    expect(model.doEmbedCalls).toHaveLength(0);
    expect(
      await t.run((ctx) =>
        ctx.db.system.query("_scheduled_functions").collect()
      )
    ).toEqual([]);
  });

  it("stores nothing and stops when another release becomes active while a page is embedded", async () => {
    const { rows, run, t } = setup();
    await t.mutation(seedKnowledge);
    embedWhileAnotherReleaseActivates(t);
    expect(await run()).toMatchObject({
      embedded: expect.any(Number),
      next: null,
      stale: true,
      written: 0,
    });
    expect(await rows()).toEqual([]);
    expect(
      await t.run((ctx) =>
        ctx.db.system.query("_scheduled_functions").collect()
      )
    ).toEqual([]);
  });

  it("stores nothing and stops when another release becomes active while a surah is embedded", async () => {
    const { rows, run, t } = setup();
    await t.mutation((ctx) =>
      activateQuranSnapshot(ctx, [
        makeQuranSurah(1, 6),
        makeQuranChunk({
          firstQuranNumber: 1,
          firstVerse: 1,
          surahNumber: 1,
          verseCount: 6,
        }),
      ])
    );
    embedWhileAnotherReleaseActivates(t);
    expect(
      await run({
        position: { phase: "quran", surah: 1 },
        releaseId: TEST_RELEASE_ID,
      })
    ).toMatchObject({ next: null, stale: true, written: 0 });
    expect(await rows()).toEqual([]);
  });

  it("fails with the failure of the embedder and stores nothing of the page", async () => {
    const { failure, rows, t } = setup();
    await t.mutation(seedKnowledge);
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
    expect(await failure()).toEqual({ _tag: "GatewayFailure" });
    expect(await rows()).toEqual([]);
  });

  it("deletes the rows of earlier releases in bounded batches", async () => {
    embedWithKnowledge();
    const { run, rows, t } = setup();
    await t.mutation(async (ctx) => {
      await seedKnowledge(ctx);
      for (const ordinal of Arr.range(0, 64)) {
        await ctx.db.insert("contentSections", {
          anchor: `bagian-${ordinal}`,
          appLocale: "id",
          contentKey: "material/lesson/removed",
          count: 65,
          embedding: Arr.makeBy(embeddingDimensions, () => 0),
          excerpt: "Bagian.",
          hash: "sha256:old",
          headingPath: [],
          model: "google/gemini-embedding-2",
          ordinal,
          publicPath: "materi/removed",
          releaseId: "release-earlier",
          scope: ["id", "material"],
          section: "material",
          text: "Bagian",
        });
      }
    });
    const position = { phase: "prune" } as const;
    const releaseId = KNOWLEDGE_RELEASE.releaseId;
    const first = await run({ position, releaseId });
    expect(first.next).toEqual({ position, releaseId });
    expect(await rows()).toHaveLength(1);
    expect(await run({ position, releaseId })).toMatchObject({
      next: null,
      stale: false,
    });
    expect(await rows()).toHaveLength(0);
  });

  it("indexes the Quran a surah at a time, in bounded batches", async () => {
    const model = embedWithKnowledge();
    const { rows, run, t } = setup();
    const verses = 300;
    const chunk = 6;
    await t.mutation((ctx) =>
      activateQuranSnapshot(ctx, [
        makeQuranSurah(2, verses),
        ...Arr.makeBy(verses / chunk, (index) =>
          makeQuranChunk({
            firstQuranNumber: index * chunk + 1,
            firstVerse: index * chunk + 1,
            surahNumber: 2,
            verseCount: chunk,
          })
        ),
      ])
    );
    const result = await run({
      position: { phase: "quran", surah: 2 },
      releaseId: TEST_RELEASE_ID,
    });
    const passages = (verses / chunk) * 3;
    expect(result).toMatchObject({
      embedded: passages,
      next: {
        position: { phase: "quran", surah: 3 },
        releaseId: TEST_RELEASE_ID,
      },
      written: passages,
    });
    expect(model.doEmbedCalls).toHaveLength(
      Math.ceil(passages / EMBED_BATCH_SIZE)
    );
    expect(await rows()).toHaveLength(passages);
  });

  it("builds the active release when a manual start names no release", async () => {
    embedWithKnowledge();
    const { run, t } = setup();
    await t.mutation(activateQuranSource);
    expect(await run({ position: { phase: "quran", surah: 1 } })).toMatchObject(
      {
        next: { position: { phase: "prune" }, releaseId: TEST_RELEASE_ID },
        stale: false,
      }
    );
  });

  it("follows the last surah with the clean up", async () => {
    embedWithKnowledge();
    const { run, t } = setup();
    await t.mutation((ctx) =>
      activateQuranSnapshot(ctx, [
        makeQuranSurah(114, 6),
        makeQuranChunk({
          firstQuranNumber: 6231,
          firstVerse: 1,
          surahNumber: 114,
          verseCount: 6,
        }),
      ])
    );
    expect(
      await run({
        position: { phase: "quran", surah: 114 },
        releaseId: TEST_RELEASE_ID,
      })
    ).toMatchObject({
      next: { position: { phase: "prune" }, releaseId: TEST_RELEASE_ID },
    });
  });
});
