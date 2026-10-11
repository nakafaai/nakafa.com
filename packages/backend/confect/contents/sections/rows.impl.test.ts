import { Ref } from "@confect/core";
import { describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { embeddingDimensions } from "@repo/backend/confect/gateway/model";
import { createConvexTestWithBetterAuth } from "@repo/backend/confect/test.helpers";
import { KNOWLEDGE_RELEASE, seedKnowledge } from "@repo/backend/test/knowledge";
import { activateQuranSource } from "@repo/backend/test/quran/snapshot";
import { Array as Arr } from "effect";

const rows = refs.internal.contents.sections.rows;
const lessons = Ref.getFunctionReference(rows.lessons);
const surah = Ref.getFunctionReference(rows.surah);
const stored = Ref.getFunctionReference(rows.stored);
const save = Ref.getFunctionReference(rows.save);
const prune = Ref.getFunctionReference(rows.prune);
const finish = Ref.getFunctionReference(rows.finish);
const page = Ref.getFunctionReference(rows.page);

const section = {
  anchor: "bentuk-matriks",
  appLocale: "id",
  contentKey: "material/lesson/matematika/matriks",
  count: 3,
  excerpt: "Matriks menyusun bilangan.",
  hash: "sha256:first",
  headingPath: ["Bentuk Matriks"],
  ordinal: 1,
  publicPath: "materi/matematika/matriks",
  section: "material",
  text: "Matriks\nBentuk Matriks\nMatriks menyusun bilangan.",
} as const;

const key = {
  appLocale: section.appLocale,
  contentKey: section.contentKey,
  hash: section.hash,
  ordinal: section.ordinal,
};

describe("section rows", () => {
  it("reads the lessons of the active release", async () => {
    const t = createConvexTestWithBetterAuth();
    await t.mutation(seedKnowledge);
    expect(await t.query(lessons, { cursor: null })).toMatchObject({
      kind: "page",
      releaseId: KNOWLEDGE_RELEASE.releaseId,
    });
    expect(
      await t.query(lessons, { cursor: null, releaseId: "release-earlier" })
    ).toEqual({ kind: "stale" });
  });

  it("reads the Quran of the active release", async () => {
    const t = createConvexTestWithBetterAuth();
    await t.mutation(activateQuranSource);
    expect(await t.query(surah, { surah: 1 })).toMatchObject({ kind: "none" });
  });

  it("stores sections, tells which are stored, and deletes those of other releases", async () => {
    const t = createConvexTestWithBetterAuth();
    await t.mutation(seedKnowledge);
    const model = "google/gemini-embedding-2";
    const sections = [
      { ...section, embedding: Arr.makeBy(embeddingDimensions, () => 0.5) },
    ];
    expect(
      await t.mutation(save, {
        model,
        releaseId: "release-earlier",
        sections,
      })
    ).toEqual({ kept: 0, missing: 0, stale: true, written: 0 });
    expect(
      await t.mutation(save, {
        model,
        releaseId: KNOWLEDGE_RELEASE.releaseId,
        sections,
      })
    ).toEqual({ kept: 0, missing: 0, stale: false, written: 1 });
    expect(await t.query(stored, { model, sections: [key] })).toEqual([true]);
    expect(
      await t.mutation(prune, { releaseId: KNOWLEDGE_RELEASE.releaseId })
    ).toEqual({ deleted: 0, done: true });
    await t.mutation(async (ctx) => {
      for (const row of await ctx.db.query("contentSections").collect()) {
        await ctx.db.patch("contentSections", row._id, {
          releaseId: "release-earlier",
        });
      }
    });
    expect(
      await t.mutation(prune, { releaseId: KNOWLEDGE_RELEASE.releaseId })
    ).toEqual({ deleted: 1, done: true });
    expect(await t.query(stored, { model, sections: [key] })).toEqual([false]);
  });

  it("records a finished build for the active release only", async () => {
    const t = createConvexTestWithBetterAuth();
    await t.mutation(seedKnowledge);
    const model = "google/gemini-embedding-2";
    expect(
      await t.mutation(finish, { model, releaseId: "release-earlier" })
    ).toEqual({ recorded: false });
    expect(
      await t.mutation(finish, {
        model,
        releaseId: KNOWLEDGE_RELEASE.releaseId,
      })
    ).toEqual({ recorded: true });
    expect(
      await t.query((ctx) => ctx.db.query("contentSectionState").collect())
    ).toMatchObject([
      { key: "primary", model, releaseId: KNOWLEDGE_RELEASE.releaseId },
    ]);
  });

  it("reads the stored sections of a language back, a page at a time", async () => {
    const t = createConvexTestWithBetterAuth();
    await t.mutation(seedKnowledge);
    await t.mutation(save, {
      model: "google/gemini-embedding-2",
      releaseId: KNOWLEDGE_RELEASE.releaseId,
      sections: [
        { ...section, embedding: Arr.makeBy(embeddingDimensions, () => 0.5) },
      ],
    });
    expect(await t.query(page, { appLocale: "id", cursor: null })).toEqual({
      next: null,
      sections: [
        {
          contentKey: section.contentKey,
          headingPath: section.headingPath,
          ordinal: section.ordinal,
          text: section.text,
        },
      ],
    });
    expect(await t.query(page, { appLocale: "de", cursor: null })).toEqual({
      next: null,
      sections: [],
    });
  });
});
