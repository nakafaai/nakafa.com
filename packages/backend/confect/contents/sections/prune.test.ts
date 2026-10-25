import { RegisteredConvexFunction } from "@confect/server";
import { describe, expect, it } from "@effect/vitest";
import confectSchema from "@repo/backend/confect/_generated/schema";
import {
  PRUNE_BATCH_SIZE,
  PRUNE_SOURCES_PER_PAGE,
} from "@repo/backend/confect/contents/sections/limits";
import { pruneSections } from "@repo/backend/confect/contents/sections/prune";
import type {
  SectionDraft,
  Source,
} from "@repo/backend/confect/contents/sections/schema";
import { storeDocument } from "@repo/backend/confect/contents/sections/store";
import {
  embeddingDimensions,
  embeddingModelId,
} from "@repo/backend/confect/gateway/model";
import { createConvexTestWithBetterAuth } from "@repo/backend/confect/test.helpers";
import { TEST_RELEASE_ID } from "@repo/backend/test/content/release";
import {
  KNOWLEDGE_RELEASE,
  knowledgeSource,
  leaveDocument,
  retireKnowledgeLesson,
  seedKnowledge,
} from "@repo/backend/test/knowledge";
import { makeQuranChunk, makeQuranSurah } from "@repo/backend/test/quran/rows";
import {
  activateQuranSnapshot,
  activateQuranSource,
} from "@repo/backend/test/quran/snapshot";
import { Array as Arr, Effect } from "effect";

const ACTIVE = KNOWLEDGE_RELEASE.releaseId;

/** A lesson that no release publishes. */
const removed: Source = {
  appLocale: "id",
  contentKey: "material/lesson/removed",
  section: "material",
  version: "left",
};

/** Another lesson that no release publishes, which the index lists after the first. */
const removedToo: Source = {
  ...removed,
  contentKey: "material/lesson/removed-too",
};

/** Rows of a document that fills a little more than half of a batch, so that two of them do not fit one. */
const OVER_HALF = PRUNE_BATCH_SIZE / 2 + 1;

/** The first surah of the Quran, as the index names its document. */
const fatiha: Source = {
  appLocale: "id",
  contentKey: "quran/1",
  section: "quran",
  version: "left",
};

/**
 * Stores a document the way a build stores one whose model leaves a section
 * out: the first section has its vector, and the second has none.
 */
function storingLeavingOut(source: Source) {
  const section = (ordinal: number): SectionDraft => ({
    anchor: `bagian-${ordinal}`,
    appLocale: source.appLocale,
    contentKey: source.contentKey,
    count: 2,
    excerpt: "Bagian.",
    hash: `sha256:${ordinal}`,
    headingPath: [],
    ordinal,
    publicPath: "materi/lama",
    section: source.section,
    text: "Bagian",
  });
  return storeDocument({
    model: embeddingModelId,
    releaseId: ACTIVE,
    sections: [
      { ...section(0), embedding: Arr.makeBy(embeddingDimensions, () => 0) },
      section(1),
    ],
    source,
  });
}

/** What a test does to the clean-up of one deployment. */
function against(t: ReturnType<typeof createConvexTestWithBetterAuth>) {
  const prune = (releaseId: string, cursor: string | null = null) =>
    t.mutation((ctx) =>
      Effect.runPromise(
        pruneSections({ cursor, releaseId }).pipe(
          Effect.provide(
            RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
          )
        )
      )
    );
  const fail = (releaseId: string) =>
    t.mutation((ctx) =>
      Effect.runPromise(
        Effect.flip(pruneSections({ cursor: null, releaseId })).pipe(
          // A mutation returns Convex values, which an error is not.
          Effect.map(({ _tag, code }) => ({ _tag, code })),
          Effect.provide(
            RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
          )
        )
      )
    );
  const rows = () =>
    t.query((ctx) => ctx.db.query("contentSections").collect());
  const sources = () =>
    t.query((ctx) => ctx.db.query("contentSectionSources").collect());
  return { fail, prune, rows, sources, t };
}

/** A deployment whose active release is the one of the knowledge fixture. */
async function setup() {
  const t = createConvexTestWithBetterAuth();
  await t.mutation(seedKnowledge);
  return against(t);
}

/** A deployment whose active release holds the first surah of the Quran and no lesson. */
async function withQuran() {
  const t = createConvexTestWithBetterAuth();
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
  return against(t);
}

describe("section prune", () => {
  it("keeps the documents that the active release publishes", async () => {
    const { prune, rows, sources, t } = await setup();
    await t.mutation(async (ctx) => {
      await leaveDocument(ctx, knowledgeSource(1, "id"), [0, 1, 2]);
      await leaveDocument(ctx, knowledgeSource(2, "de"), [0, 1]);
    });
    expect(await prune(ACTIVE)).toMatchObject({
      deleted: 0,
      done: true,
      stale: false,
    });
    expect(await rows()).toHaveLength(5);
    expect(await sources()).toHaveLength(2);
  });

  it("deletes the sections and the record of a document that no release publishes", async () => {
    const { prune, rows, sources, t } = await setup();
    await t.mutation(async (ctx) => {
      await leaveDocument(ctx, removed, [0, 1]);
      await leaveDocument(ctx, knowledgeSource(1, "id"), [0]);
    });
    expect(await prune(ACTIVE)).toMatchObject({ deleted: 2, done: true });
    expect(Arr.map(await sources(), ({ contentKey }) => contentKey)).toEqual([
      knowledgeSource(1, "id").contentKey,
    ]);
    expect(await rows()).toHaveLength(1);
  });

  it("deletes a document whose newest version deletes it", async () => {
    const { prune, rows, sources, t } = await setup();
    await t.mutation(async (ctx) => {
      await leaveDocument(ctx, knowledgeSource(1, "id"), [0, 1]);
      await retireKnowledgeLesson(ctx, 1, "id");
    });
    expect(await prune(ACTIVE)).toMatchObject({ deleted: 2, done: true });
    expect(await sources()).toEqual([]);
    expect(await rows()).toEqual([]);
  });

  it("deletes a document with a section left out, which no release publishes, with the section it holds", async () => {
    const { prune, rows, sources, t } = await setup();
    await t.mutation((ctx) =>
      Effect.runPromise(
        storingLeavingOut(removed).pipe(
          Effect.provide(
            RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
          )
        )
      )
    );
    expect(await sources()).toMatchObject([{ ...removed, missing: 1 }]);
    expect(await rows()).toHaveLength(1);
    expect(await prune(ACTIVE)).toMatchObject({ deleted: 1, done: true });
    expect(await rows()).toEqual([]);
    expect(await sources()).toEqual([]);
  });

  it("deletes a document that fills the whole batch in one call, with its record", async () => {
    const { prune, rows, sources, t } = await setup();
    await t.mutation((ctx) =>
      leaveDocument(ctx, removed, Arr.range(1, PRUNE_BATCH_SIZE))
    );
    expect(await prune(ACTIVE)).toMatchObject({
      deleted: PRUNE_BATCH_SIZE,
      done: true,
    });
    expect(await rows()).toEqual([]);
    expect(await sources()).toEqual([]);
  });

  it("stops before a document that does not fit what is left of the batch, and leaves it whole", async () => {
    const { prune, rows, sources, t } = await setup();
    await t.mutation(async (ctx) => {
      await leaveDocument(ctx, removed, Arr.range(1, OVER_HALF));
      await leaveDocument(ctx, removedToo, Arr.range(1, OVER_HALF));
    });
    expect(await prune(ACTIVE)).toEqual({
      cursor: null,
      deleted: OVER_HALF,
      done: false,
      stale: false,
    });
    // The second document has all its rows, so it goes whole with its record
    // in the next call.
    expect(Arr.map(await rows(), ({ contentKey }) => contentKey)).toEqual(
      Arr.makeBy(OVER_HALF, () => removedToo.contentKey)
    );
    expect(Arr.map(await sources(), ({ contentKey }) => contentKey)).toEqual([
      removedToo.contentKey,
    ]);
    expect(await prune(ACTIVE)).toMatchObject({
      deleted: OVER_HALF,
      done: true,
    });
    expect(await rows()).toEqual([]);
    expect(await sources()).toEqual([]);
  });

  it("fails, and deletes nothing, for a document that holds more sections than a document may have", async () => {
    const { fail, rows, sources, t } = await setup();
    await t.mutation((ctx) =>
      leaveDocument(ctx, removed, Arr.range(1, PRUNE_BATCH_SIZE + 1))
    );
    expect(await fail(ACTIVE)).toEqual({
      _tag: "ReleaseError",
      code: "CONTENT_RELEASE_LIMIT",
    });
    expect(await rows()).toHaveLength(PRUNE_BATCH_SIZE + 1);
    expect(await sources()).toHaveLength(1);
  });

  it("checks a page of documents at a time and says where the next page begins", async () => {
    const { prune, t } = await setup();
    await t.mutation(async (ctx) => {
      for (const number of Arr.range(1, PRUNE_SOURCES_PER_PAGE + 6)) {
        await ctx.db.insert(
          "contentSectionSources",
          knowledgeSource(1, "en", `left-${number}`)
        );
      }
    });
    const first = await prune(ACTIVE);
    expect(first).toMatchObject({ deleted: 0, done: false });
    expect(first.cursor).toEqual(expect.any(String));
    expect(await prune(ACTIVE, first.cursor)).toMatchObject({
      deleted: 0,
      done: true,
    });
  });

  it("keeps the Quran while the active release has one", async () => {
    const { prune, rows, sources, t } = await withQuran();
    await t.mutation((ctx) => leaveDocument(ctx, fatiha, [0]));
    expect(await prune(TEST_RELEASE_ID)).toMatchObject({
      deleted: 0,
      done: true,
    });
    expect(await rows()).toHaveLength(1);
    expect(await sources()).toHaveLength(1);
  });

  it("deletes the Quran when the active release has none", async () => {
    const t = createConvexTestWithBetterAuth();
    await t.mutation(activateQuranSource);
    const { prune, rows, sources } = against(t);
    await t.mutation((ctx) => leaveDocument(ctx, fatiha, [0, 1]));
    expect(await prune(TEST_RELEASE_ID)).toMatchObject({
      deleted: 2,
      done: true,
    });
    expect(await rows()).toEqual([]);
    expect(await sources()).toEqual([]);
  });

  it("does nothing for a release that is not the active one", async () => {
    const { prune, rows, sources, t } = await setup();
    await t.mutation((ctx) => leaveDocument(ctx, removed, [0]));
    expect(await prune("release-earlier")).toEqual({
      cursor: null,
      deleted: 0,
      done: true,
      stale: true,
    });
    expect(await rows()).toHaveLength(1);
    expect(await sources()).toHaveLength(1);
  });

  it("does nothing while no release is active", async () => {
    const { prune } = against(createConvexTestWithBetterAuth());
    expect(await prune("release-0")).toMatchObject({ stale: true });
  });
});
