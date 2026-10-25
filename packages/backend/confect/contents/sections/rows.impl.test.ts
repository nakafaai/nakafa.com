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

const source = {
  appLocale: section.appLocale,
  contentKey: section.contentKey,
  section: section.section,
  version: "1:google/gemini-embedding-2:first",
} as const;

/** Asks whether the document holds the text of the section the function stores. */
const known = {
  appLocale: section.appLocale,
  contentKey: section.contentKey,
  hashes: [section.hash],
  model: "google/gemini-embedding-2",
};

const model = "google/gemini-embedding-2";
const sections = [
  { ...section, embedding: Arr.makeBy(embeddingDimensions, () => 0.5) },
];

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
    expect(await t.query(surah, { surah: 1 })).toMatchObject({ kind: "done" });
  });

  it("stores a document, tells which sections are stored, and deletes a document that is not published", async () => {
    const t = createConvexTestWithBetterAuth();
    await t.mutation(seedKnowledge);
    expect(
      await t.mutation(save, {
        model,
        releaseId: "release-earlier",
        sections,
        source,
      })
    ).toEqual({ kept: 0, missing: 0, removed: 0, stale: true, written: 0 });
    expect(
      await t.mutation(save, {
        model,
        releaseId: KNOWLEDGE_RELEASE.releaseId,
        sections,
        source,
      })
    ).toEqual({ kept: 0, missing: 0, removed: 0, stale: false, written: 1 });
    expect(await t.query(stored, known)).toEqual([true]);
    // The fixture publishes no lesson with this identity.
    expect(
      await t.mutation(prune, {
        cursor: null,
        releaseId: KNOWLEDGE_RELEASE.releaseId,
      })
    ).toMatchObject({ deleted: 1, done: true, stale: false });
    expect(await t.query(stored, known)).toEqual([false]);
  });

  it("records a finished build for the active release only", async () => {
    const t = createConvexTestWithBetterAuth();
    await t.mutation(seedKnowledge);
    expect(
      await t.mutation(finish, {
        missing: 0,
        model,
        releaseId: "release-earlier",
      })
    ).toEqual({ recorded: false });
    expect(
      await t.mutation(finish, {
        missing: 0,
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
      model,
      releaseId: KNOWLEDGE_RELEASE.releaseId,
      sections,
      source,
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
