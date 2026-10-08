import type { createConvexTestWithBetterAuth } from "@repo/backend/confect/test.helpers";
import {
  insertRuntimeArticles,
  testArticleProjection,
} from "@repo/backend/test/content/runtime";
import {
  makeQuranAttribution,
  makeQuranChunk,
  makeQuranSearch,
  makeQuranSurah,
} from "@repo/backend/test/quran/rows";
import { activateQuranSnapshot } from "@repo/backend/test/quran/snapshot";
import { insertRuntimeIndex } from "@repo/backend/test/runtime/head";
import { TEST_RUNTIME_RELEASE } from "@repo/backend/test/runtime/values";
import { Array as Arr } from "effect";

type BackendTest = ReturnType<typeof createConvexTestWithBetterAuth>;

/** Publishes one signed article whose text the search index covers. */
export async function seedArticle(test: BackendTest) {
  const article = testArticleProjection(0);
  await test.mutation(async (ctx) => {
    await insertRuntimeArticles(ctx, 1);
    await insertRuntimeIndex(ctx, article.contentKey, {
      plainText: "rational function grade eleven asymptote",
    });
    const state = await ctx.db.query("contentState").unique();
    if (!state) {
      throw new Error("Expected one active content state.");
    }
    await ctx.db.patch("contentState", state._id, {
      searchManifestHash: TEST_RUNTIME_RELEASE.manifestHash,
      searchReleaseId: TEST_RUNTIME_RELEASE.releaseId,
      searchSequence: TEST_RUNTIME_RELEASE.sequence,
    });
  });
}

/** Publishes the signed Quran catalog, with surah 1 at its seven verses. */
export async function seedQuran(test: BackendTest) {
  await test.mutation((ctx) =>
    activateQuranSnapshot(ctx, [
      makeQuranAttribution(),
      ...Arr.makeBy(114, (index) =>
        makeQuranSurah(index + 1, index === 0 ? 7 : 1)
      ),
      makeQuranChunk({
        firstQuranNumber: 1,
        firstVerse: 1,
        surahNumber: 1,
        verseCount: 6,
      }),
      makeQuranChunk({
        firstQuranNumber: 7,
        firstVerse: 7,
        surahNumber: 1,
        verseCount: 1,
      }),
      makeQuranSearch("en", 1),
    ])
  );
}
