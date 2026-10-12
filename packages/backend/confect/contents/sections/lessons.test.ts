import { RegisteredConvexFunction } from "@confect/server";
import { describe, expect, it } from "@effect/vitest";
import confectSchema from "@repo/backend/confect/_generated/schema";
import { readLessons } from "@repo/backend/confect/contents/sections/lessons";
import { LESSONS_PER_STEP } from "@repo/backend/confect/contents/sections/limits";
import type { lessonValidator } from "@repo/backend/confect/contents/sections/schema";
import { createConvexTestWithBetterAuth } from "@repo/backend/confect/test.helpers";
import {
  editKnowledgeLesson,
  KNOWLEDGE_RELEASE,
  knowledgeLesson,
  seedKnowledge,
} from "@repo/backend/test/knowledge";
import { Array as Arr, Effect, Order } from "effect";

function setup() {
  const t = createConvexTestWithBetterAuth();
  const read = (input: Parameters<typeof readLessons>[0]) =>
    t.mutation((ctx) =>
      Effect.runPromise(
        readLessons(input).pipe(
          Effect.provide(
            RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
          )
        )
      )
    );
  const fail = (input: Parameters<typeof readLessons>[0]) =>
    t.mutation((ctx) =>
      Effect.runPromise(
        Effect.flip(readLessons(input)).pipe(
          // A mutation returns Convex values, which an error is not.
          Effect.map(({ _tag, code }) => ({ _tag, code })),
          Effect.provide(
            RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
          )
        )
      )
    );
  /** Reads every page of lessons, and gives the lessons and the number passed over. */
  const readAll = async () => {
    let cursor: string | null = null;
    let lessons: readonly (typeof lessonValidator.Type)[] = [];
    let unchanged = 0;
    do {
      const page = await read({ cursor });
      if (page.kind !== "page") {
        throw new Error("Expected a page of lessons.");
      }
      lessons = Arr.appendAll(lessons, page.lessons);
      unchanged += page.unchanged;
      cursor = page.next;
    } while (cursor !== null);
    return { lessons, unchanged };
  };
  return { fail, read, readAll, t };
}

describe("section lessons", () => {
  it("reads the lessons and articles of the active release a page at a time", async () => {
    const { read, t } = setup();
    await t.mutation(seedKnowledge);
    const first = await read({ cursor: null });
    if (first.kind !== "page" || first.next === null) {
      throw new Error("Expected a first page with a page after it.");
    }
    expect(first.lessons).toHaveLength(LESSONS_PER_STEP);
    expect(first.unchanged).toBe(0);
    expect(first.releaseId).toBe(KNOWLEDGE_RELEASE.releaseId);
    const second = await read({
      cursor: first.next,
      releaseId: KNOWLEDGE_RELEASE.releaseId,
    });
    if (second.kind !== "page") {
      throw new Error("Expected a second page.");
    }
    expect(second.next).toBeNull();
    const lessons = [...first.lessons, ...second.lessons];
    expect(lessons).toHaveLength(9);
    expect(
      Arr.sort(
        Arr.map(lessons, ({ section }) => section),
        Order.String
      )
    ).toEqual([
      "articles",
      "articles",
      "articles",
      "material",
      "material",
      "material",
      "material",
      "material",
      "material",
    ]);
    expect(lessons).toContainEqual({
      appLocale: "id",
      contentKey: "material/lesson/mathematics/technical-topic/section-1",
      publicPath: expect.stringContaining("section-1"),
      rawMdx: knowledgeLesson(1, "id"),
      section: "material",
      title: "ID Section 1",
      version: expect.stringContaining("1:google/gemini-embedding-2:sha256:"),
    });
  });

  it("names the version of a lesson by the signed facts of its source", async () => {
    const { readAll, t } = setup();
    await t.mutation(seedKnowledge);
    const before = await readAll();
    const versions = Arr.map(before.lessons, ({ version }) => version);
    expect(Arr.dedupe(versions)).toHaveLength(versions.length);
    await t.mutation((ctx) => editKnowledgeLesson(ctx, 1, "id", "Teks baru."));
    const after = await readAll();
    expect(
      Arr.map(
        Arr.filter(
          after.lessons,
          ({ version }) => !Arr.contains(versions, version)
        ),
        ({ appLocale, rawMdx }) => [appLocale, rawMdx]
      )
    ).toEqual([["id", "Teks baru."]]);
  });

  it("passes over a lesson whose sections the index holds at its version, without reading its artifact", async () => {
    const { readAll, t } = setup();
    await t.mutation(seedKnowledge);
    const { lessons } = await readAll();
    await t.mutation(async (ctx) => {
      for (const { appLocale, contentKey, section, version } of lessons) {
        await ctx.db.insert("contentSectionSources", {
          appLocale,
          contentKey,
          section,
          version,
        });
      }
    });
    // The artifact of a lesson that is passed over is never read, so it may be gone.
    await t.mutation(async (ctx) => {
      for (const artifact of await ctx.db.query("contentArtifacts").collect()) {
        await ctx.db.delete("contentArtifacts", artifact._id);
      }
    });
    expect(await readAll()).toEqual({ lessons: [], unchanged: 9 });
  });

  it("reads again the lesson whose source changed or whose sections were made at another version", async () => {
    const { readAll, t } = setup();
    await t.mutation(seedKnowledge);
    const { lessons } = await readAll();
    await t.mutation(async (ctx) => {
      for (const { appLocale, contentKey, section, version } of lessons) {
        await ctx.db.insert("contentSectionSources", {
          appLocale,
          contentKey,
          section,
          version: appLocale === "de" ? "1:an-older-model:x" : version,
        });
      }
    });
    await t.mutation((ctx) => editKnowledgeLesson(ctx, 2, "en", "Neu."));
    const again = await readAll();
    expect(again.unchanged).toBe(5);
    expect(
      Arr.sort(
        Arr.map(again.lessons, ({ appLocale, rawMdx }) =>
          appLocale === "en" ? rawMdx : appLocale
        ),
        Order.String
      )
    ).toEqual(["Neu.", "de", "de", "de"]);
  });

  it("is stale when the build began for another release", async () => {
    const { read, t } = setup();
    await t.mutation(seedKnowledge);
    expect(await read({ cursor: null, releaseId: "release-earlier" })).toEqual({
      kind: "stale",
    });
  });

  it("is stale while no release is active", async () => {
    const { read } = setup();
    expect(await read({ cursor: null })).toEqual({ kind: "stale" });
  });

  it("fails while the search model of the release is still synchronizing", async () => {
    const { fail, t } = setup();
    await t.mutation(async (ctx) => {
      await seedKnowledge(ctx);
      const state = await ctx.db.query("contentState").unique();
      if (!state) {
        throw new Error("Expected one content state.");
      }
      await ctx.db.patch("contentState", state._id, {
        searchReleaseId: "release-building",
      });
    });
    expect(await fail({ cursor: null })).toMatchObject({
      _tag: "ReleaseError",
      code: "CONTENT_RELEASE_STATE",
    });
  });

  it("fails for a lesson whose head lost its artifact", async () => {
    const { fail, t } = setup();
    await t.mutation(async (ctx) => {
      await seedKnowledge(ctx);
      for (const head of await ctx.db.query("contentHeads").collect()) {
        await ctx.db.patch("contentHeads", head._id, {
          artifactHash: undefined,
        });
      }
    });
    expect(await fail({ cursor: null })).toMatchObject({
      _tag: "ReleaseError",
      code: "CONTENT_RELEASE_INTEGRITY",
    });
  });
});
