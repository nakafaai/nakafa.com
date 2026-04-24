import {
  fetchContentForAudio,
  getAudioContentLookup,
  getLocalizedAudioContentLookup,
  getResetAudioFields,
  updateContentHash,
} from "@repo/backend/convex/audioStudies/utils";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { convexTest } from "convex-test";
import { describe, expect, it, vi } from "vitest";

const REAL_VECTOR_PUBLISHED_AT = 1_744_416_000_000;
const REAL_VECTOR_TOPIC_SLUG =
  "subject/high-school/10/mathematics/vector-operations";
const REAL_VECTOR_SECTION_SLUG =
  "subject/high-school/10/mathematics/vector-operations/vector-addition";
const REAL_VECTOR_TOPIC_SECTION_COUNT = 15;
const REAL_DYNASTIC_ARTICLE_PUBLISHED_AT = 1_723_075_200_000;
const REAL_DYNASTIC_ARTICLE_SLUG =
  "articles/politics/dynastic-politics-asian-values";
const REAL_DYNASTIC_ARTICLE_ID = "dynastic-politics-asian-values";

const REAL_VECTOR_ADDITION_EN = {
  body: [
    "Vector addition differs from scalar addition.",
    "In scalar addition, we only add magnitudes without considering direction.",
    "For example, 2 kg of sugar plus 3 kg of sugar equals 5 kg of sugar.",
    "However, in vector addition, we must consider both magnitude and direction.",
  ].join(" "),
  description:
    "Master vector addition using triangle, parallelogram & polygon methods. Learn resultant calculations, component addition, and real-world applications.",
  hash: "6e40f13a4b930997ea9f43990009a3566eaa92358fd04faf749ff3ac141a1a2c",
  locale: "en" as const,
  section: "vector-addition",
  subject: "Vector and Operations",
  title: "Vector Addition",
  topic: "vector-operations",
  topicTitle: "Vector and Operations",
};

const REAL_VECTOR_ADDITION_ID = {
  body: [
    "Penjumlahan vektor berbeda dengan penjumlahan skalar.",
    "Pada penjumlahan skalar, kita hanya menjumlahkan besaran tanpa memperhatikan arah.",
    "Contohnya, 2 kg gula ditambah 3 kg gula menghasilkan 5 kg gula.",
    "Namun, pada penjumlahan vektor, kita harus memperhatikan besaran dan arah.",
  ].join(" "),
  description:
    "Kuasai penjumlahan vektor dengan metode segitiga, jajar genjang & poligon. Pelajari perhitungan resultan, komponen, dan aplikasi dunia nyata.",
  hash: "99a0aa935aef948b7a158a57ae3bf2c26bfb0db1dab219958371f8c4b5eb5499",
  locale: "id" as const,
  section: "vector-addition",
  subject: "Vektor dan Operasinya",
  title: "Penjumlahan Vektor",
  topic: "vector-operations",
  topicTitle: "Vektor dan Operasinya",
};

const REAL_DYNASTIC_ARTICLE_EN = {
  body: [
    "The legitimacy of dynastic politics within the framework of democracy in Indonesia is increasing.",
    "This study discusses how Asian values grow and are used as a basis for rationalizing the practice of dynastic politics.",
    "This research uses previous studies to compile a structured analysis with a descriptive qualitative approach.",
  ].join(" "),
  description:
    "Power is passed down under the guise of practicing asian values.",
  hash: "c70075b35dce7605d89c0257286f47c5ee99d69de9656debdcf3d0e1146a0d07",
  locale: "en" as const,
  title: "Framing Dynastic Politics in Local Elections within Asian Values",
};

const REAL_DYNASTIC_ARTICLE_ID_LOCALE = {
  body: [
    "Legitimasi politik dinasti dalam kerangka demokrasi di Indonesia semakin meningkat.",
    "Studi ini membahas bagaimana nilai-nilai Asia tumbuh dan digunakan sebagai dasar untuk merasionalisasi praktik politik dinasti.",
    "Penelitian ini menggunakan studi-studi sebelumnya untuk menyusun analisis terstruktur dengan pendekatan kualitatif deskriptif.",
  ].join(" "),
  description:
    "Kekuasaan diwariskan dengan dalih mempraktikkan nilai-nilai Asia.",
  hash: "101adf17e52c93601b8a572b1494507438079cd08c251cd410cbc785a2a7cf5e",
  locale: "id" as const,
  title:
    "Membingkai Politik Dinasti dalam Pemilihan Lokal dalam Nilai-Nilai Asia",
};

describe("audioStudies/utils", () => {
  it("loads real article content and lookup metadata", async () => {
    const t = convexTest(schema, convexModules);

    const articleId = await t.mutation(
      async (ctx) =>
        await ctx.db.insert("articleContents", {
          locale: REAL_DYNASTIC_ARTICLE_EN.locale,
          slug: REAL_DYNASTIC_ARTICLE_SLUG,
          category: "politics",
          articleSlug: REAL_DYNASTIC_ARTICLE_ID,
          title: REAL_DYNASTIC_ARTICLE_EN.title,
          description: REAL_DYNASTIC_ARTICLE_EN.description,
          date: REAL_DYNASTIC_ARTICLE_PUBLISHED_AT,
          body: REAL_DYNASTIC_ARTICLE_EN.body,
          contentHash: REAL_DYNASTIC_ARTICLE_EN.hash,
          syncedAt: 1,
        })
    );

    const result = await t.query(async (ctx) => ({
      content: await fetchContentForAudio(ctx, {
        type: "article",
        id: articleId,
      }),
      lookup: await getAudioContentLookup(ctx, {
        type: "article",
        id: articleId,
      }),
    }));

    expect(result).toEqual({
      content: {
        title: REAL_DYNASTIC_ARTICLE_EN.title,
        description: REAL_DYNASTIC_ARTICLE_EN.description,
        body: REAL_DYNASTIC_ARTICLE_EN.body,
        locale: REAL_DYNASTIC_ARTICLE_EN.locale,
      },
      lookup: {
        contentHash: REAL_DYNASTIC_ARTICLE_EN.hash,
        locale: REAL_DYNASTIC_ARTICLE_EN.locale,
        ref: { type: "article", id: articleId },
        slug: REAL_DYNASTIC_ARTICLE_SLUG,
      },
    });
  });

  it("loads real subject content and lookup metadata", async () => {
    const t = convexTest(schema, convexModules);

    const subjectId = await t.mutation(
      async (ctx) =>
        await ctx.db.insert("subjectSections", {
          topicId: await ctx.db.insert("subjectTopics", {
            category: "high-school",
            grade: "10",
            material: "mathematics",
            topic: REAL_VECTOR_ADDITION_EN.topic,
            title: REAL_VECTOR_ADDITION_EN.topicTitle,
            locale: REAL_VECTOR_ADDITION_EN.locale,
            slug: REAL_VECTOR_TOPIC_SLUG,
            sectionCount: REAL_VECTOR_TOPIC_SECTION_COUNT,
            syncedAt: 1,
          }),
          locale: REAL_VECTOR_ADDITION_EN.locale,
          slug: REAL_VECTOR_SECTION_SLUG,
          category: "high-school",
          grade: "10",
          material: "mathematics",
          topic: REAL_VECTOR_ADDITION_EN.topic,
          section: REAL_VECTOR_ADDITION_EN.section,
          title: REAL_VECTOR_ADDITION_EN.title,
          description: REAL_VECTOR_ADDITION_EN.description,
          date: REAL_VECTOR_PUBLISHED_AT,
          subject: REAL_VECTOR_ADDITION_EN.subject,
          body: REAL_VECTOR_ADDITION_EN.body,
          contentHash: REAL_VECTOR_ADDITION_EN.hash,
          syncedAt: 1,
        })
    );

    const result = await t.query(async (ctx) => ({
      content: await fetchContentForAudio(ctx, {
        type: "subject",
        id: subjectId,
      }),
      lookup: await getAudioContentLookup(ctx, {
        type: "subject",
        id: subjectId,
      }),
    }));

    expect(result).toEqual({
      content: {
        title: REAL_VECTOR_ADDITION_EN.title,
        description: REAL_VECTOR_ADDITION_EN.description,
        body: REAL_VECTOR_ADDITION_EN.body,
        locale: REAL_VECTOR_ADDITION_EN.locale,
      },
      lookup: {
        contentHash: REAL_VECTOR_ADDITION_EN.hash,
        locale: REAL_VECTOR_ADDITION_EN.locale,
        ref: { type: "subject", id: subjectId },
        slug: REAL_VECTOR_SECTION_SLUG,
      },
    });
  });

  it("returns null when the requested rows do not exist", async () => {
    const t = convexTest(schema, convexModules);

    const { articleId, subjectId } = await t.mutation(async (ctx) => {
      const articleId = await ctx.db.insert("articleContents", {
        locale: REAL_DYNASTIC_ARTICLE_EN.locale,
        slug: REAL_DYNASTIC_ARTICLE_SLUG,
        category: "politics",
        articleSlug: REAL_DYNASTIC_ARTICLE_ID,
        title: REAL_DYNASTIC_ARTICLE_EN.title,
        description: REAL_DYNASTIC_ARTICLE_EN.description,
        date: REAL_DYNASTIC_ARTICLE_PUBLISHED_AT,
        body: REAL_DYNASTIC_ARTICLE_EN.body,
        contentHash: REAL_DYNASTIC_ARTICLE_EN.hash,
        syncedAt: 1,
      });
      const subjectId = await ctx.db.insert("subjectSections", {
        topicId: await ctx.db.insert("subjectTopics", {
          category: "high-school",
          grade: "10",
          material: "mathematics",
          topic: REAL_VECTOR_ADDITION_EN.topic,
          title: REAL_VECTOR_ADDITION_EN.topicTitle,
          locale: REAL_VECTOR_ADDITION_EN.locale,
          slug: REAL_VECTOR_TOPIC_SLUG,
          sectionCount: REAL_VECTOR_TOPIC_SECTION_COUNT,
          syncedAt: 1,
        }),
        locale: REAL_VECTOR_ADDITION_EN.locale,
        slug: REAL_VECTOR_SECTION_SLUG,
        category: "high-school",
        grade: "10",
        material: "mathematics",
        topic: REAL_VECTOR_ADDITION_EN.topic,
        section: REAL_VECTOR_ADDITION_EN.section,
        title: REAL_VECTOR_ADDITION_EN.title,
        description: REAL_VECTOR_ADDITION_EN.description,
        date: REAL_VECTOR_PUBLISHED_AT,
        subject: REAL_VECTOR_ADDITION_EN.subject,
        body: REAL_VECTOR_ADDITION_EN.body,
        contentHash: REAL_VECTOR_ADDITION_EN.hash,
        syncedAt: 1,
      });

      await ctx.db.delete("articleContents", articleId);
      await ctx.db.delete("subjectSections", subjectId);

      return { articleId, subjectId };
    });

    const result = await t.query(async (ctx) => ({
      articleContent: await fetchContentForAudio(ctx, {
        type: "article",
        id: articleId,
      }),
      subjectLookup: await getAudioContentLookup(ctx, {
        type: "subject",
        id: subjectId,
      }),
    }));

    expect(result).toEqual({
      articleContent: null,
      subjectLookup: null,
    });
  });

  it("returns null for missing article lookups and missing localized article rows", async () => {
    const t = convexTest(schema, convexModules);

    const { deletedArticleId, englishOnlyArticleId } = await t.mutation(
      async (ctx) => {
        const deletedArticleId = await ctx.db.insert("articleContents", {
          locale: REAL_DYNASTIC_ARTICLE_EN.locale,
          slug: `${REAL_DYNASTIC_ARTICLE_SLUG}-deleted`,
          category: "politics",
          articleSlug: `${REAL_DYNASTIC_ARTICLE_ID}-deleted`,
          title: REAL_DYNASTIC_ARTICLE_EN.title,
          description: REAL_DYNASTIC_ARTICLE_EN.description,
          date: REAL_DYNASTIC_ARTICLE_PUBLISHED_AT,
          body: REAL_DYNASTIC_ARTICLE_EN.body,
          contentHash: REAL_DYNASTIC_ARTICLE_EN.hash,
          syncedAt: 1,
        });
        const englishOnlyArticleId = await ctx.db.insert("articleContents", {
          locale: REAL_DYNASTIC_ARTICLE_EN.locale,
          slug: `${REAL_DYNASTIC_ARTICLE_SLUG}-english-only`,
          category: "politics",
          articleSlug: `${REAL_DYNASTIC_ARTICLE_ID}-english-only`,
          title: REAL_DYNASTIC_ARTICLE_EN.title,
          description: REAL_DYNASTIC_ARTICLE_EN.description,
          date: REAL_DYNASTIC_ARTICLE_PUBLISHED_AT,
          body: REAL_DYNASTIC_ARTICLE_EN.body,
          contentHash: REAL_DYNASTIC_ARTICLE_EN.hash,
          syncedAt: 1,
        });

        await ctx.db.delete("articleContents", deletedArticleId);

        return { deletedArticleId, englishOnlyArticleId };
      }
    );

    const result = await t.query(async (ctx) => {
      const englishOnlyLookup = await getAudioContentLookup(ctx, {
        type: "article",
        id: englishOnlyArticleId,
      });

      expect(englishOnlyLookup).not.toBeNull();

      if (englishOnlyLookup === null) {
        return {
          deletedLookup: null,
          missingLocalizedLookup: null,
        };
      }

      return {
        deletedLookup: await getAudioContentLookup(ctx, {
          type: "article",
          id: deletedArticleId,
        }),
        missingLocalizedLookup: await getLocalizedAudioContentLookup(
          ctx,
          englishOnlyLookup,
          "id"
        ),
      };
    });

    expect(result).toEqual({
      deletedLookup: null,
      missingLocalizedLookup: null,
    });
  });

  it("resolves same-locale, translated, and missing subject lookups", async () => {
    const t = convexTest(schema, convexModules);

    const { englishOnlyId, translatedEnglishId } = await t.mutation(
      async (ctx) => {
        const translatedEnglishId = await ctx.db.insert("subjectSections", {
          topicId: await ctx.db.insert("subjectTopics", {
            category: "high-school",
            grade: "10",
            material: "mathematics",
            topic: REAL_VECTOR_ADDITION_EN.topic,
            title: REAL_VECTOR_ADDITION_EN.topicTitle,
            locale: REAL_VECTOR_ADDITION_EN.locale,
            slug: REAL_VECTOR_TOPIC_SLUG,
            sectionCount: REAL_VECTOR_TOPIC_SECTION_COUNT,
            syncedAt: 1,
          }),
          locale: REAL_VECTOR_ADDITION_EN.locale,
          slug: REAL_VECTOR_SECTION_SLUG,
          category: "high-school",
          grade: "10",
          material: "mathematics",
          topic: REAL_VECTOR_ADDITION_EN.topic,
          section: REAL_VECTOR_ADDITION_EN.section,
          title: REAL_VECTOR_ADDITION_EN.title,
          description: REAL_VECTOR_ADDITION_EN.description,
          date: REAL_VECTOR_PUBLISHED_AT,
          subject: REAL_VECTOR_ADDITION_EN.subject,
          body: REAL_VECTOR_ADDITION_EN.body,
          contentHash: REAL_VECTOR_ADDITION_EN.hash,
          syncedAt: 1,
        });

        await ctx.db.insert("subjectSections", {
          topicId: await ctx.db.insert("subjectTopics", {
            category: "high-school",
            grade: "10",
            material: "mathematics",
            topic: REAL_VECTOR_ADDITION_ID.topic,
            title: REAL_VECTOR_ADDITION_ID.topicTitle,
            locale: REAL_VECTOR_ADDITION_ID.locale,
            slug: REAL_VECTOR_TOPIC_SLUG,
            sectionCount: REAL_VECTOR_TOPIC_SECTION_COUNT,
            syncedAt: 1,
          }),
          locale: REAL_VECTOR_ADDITION_ID.locale,
          slug: REAL_VECTOR_SECTION_SLUG,
          category: "high-school",
          grade: "10",
          material: "mathematics",
          topic: REAL_VECTOR_ADDITION_ID.topic,
          section: REAL_VECTOR_ADDITION_ID.section,
          title: REAL_VECTOR_ADDITION_ID.title,
          description: REAL_VECTOR_ADDITION_ID.description,
          date: REAL_VECTOR_PUBLISHED_AT,
          subject: REAL_VECTOR_ADDITION_ID.subject,
          body: REAL_VECTOR_ADDITION_ID.body,
          contentHash: REAL_VECTOR_ADDITION_ID.hash,
          syncedAt: 1,
        });

        const englishOnlyId = await ctx.db.insert("subjectSections", {
          topicId: await ctx.db.insert("subjectTopics", {
            category: "high-school",
            grade: "10",
            material: "mathematics",
            topic: REAL_VECTOR_ADDITION_EN.topic,
            title: REAL_VECTOR_ADDITION_EN.topicTitle,
            locale: REAL_VECTOR_ADDITION_EN.locale,
            slug: `${REAL_VECTOR_TOPIC_SLUG}-english-only`,
            sectionCount: 1,
            syncedAt: 1,
          }),
          locale: REAL_VECTOR_ADDITION_EN.locale,
          slug: `${REAL_VECTOR_SECTION_SLUG}-english-only`,
          category: "high-school",
          grade: "10",
          material: "mathematics",
          topic: REAL_VECTOR_ADDITION_EN.topic,
          section: REAL_VECTOR_ADDITION_EN.section,
          title: REAL_VECTOR_ADDITION_EN.title,
          description: REAL_VECTOR_ADDITION_EN.description,
          date: REAL_VECTOR_PUBLISHED_AT,
          subject: REAL_VECTOR_ADDITION_EN.subject,
          body: REAL_VECTOR_ADDITION_EN.body,
          contentHash: REAL_VECTOR_ADDITION_EN.hash,
          syncedAt: 1,
        });

        return { englishOnlyId, translatedEnglishId };
      }
    );

    const result = await t.query(async (ctx) => {
      const translatedLookup = await getAudioContentLookup(ctx, {
        type: "subject",
        id: translatedEnglishId,
      });
      const englishOnlyLookup = await getAudioContentLookup(ctx, {
        type: "subject",
        id: englishOnlyId,
      });

      expect(translatedLookup).not.toBeNull();
      expect(englishOnlyLookup).not.toBeNull();

      if (translatedLookup === null || englishOnlyLookup === null) {
        return {
          sameLocale: null,
          translated: null,
          missing: null,
        };
      }

      return {
        sameLocale: await getLocalizedAudioContentLookup(
          ctx,
          translatedLookup,
          "en"
        ),
        translated: await getLocalizedAudioContentLookup(
          ctx,
          translatedLookup,
          "id"
        ),
        missing: await getLocalizedAudioContentLookup(
          ctx,
          englishOnlyLookup,
          "id"
        ),
      };
    });

    expect(result.sameLocale).toEqual({
      contentHash: REAL_VECTOR_ADDITION_EN.hash,
      locale: "en",
      ref: { type: "subject", id: translatedEnglishId },
      slug: REAL_VECTOR_SECTION_SLUG,
    });
    expect(result.translated).toMatchObject({
      contentHash: REAL_VECTOR_ADDITION_ID.hash,
      locale: "id",
      ref: { type: "subject", id: expect.any(String) },
      slug: REAL_VECTOR_SECTION_SLUG,
    });
    expect(result.missing).toBeNull();
  });

  it("resolves translated article lookups", async () => {
    const t = convexTest(schema, convexModules);

    const englishArticleId = await t.mutation(async (ctx) => {
      const englishArticleId = await ctx.db.insert("articleContents", {
        locale: REAL_DYNASTIC_ARTICLE_EN.locale,
        slug: REAL_DYNASTIC_ARTICLE_SLUG,
        category: "politics",
        articleSlug: REAL_DYNASTIC_ARTICLE_ID,
        title: REAL_DYNASTIC_ARTICLE_EN.title,
        description: REAL_DYNASTIC_ARTICLE_EN.description,
        date: REAL_DYNASTIC_ARTICLE_PUBLISHED_AT,
        body: REAL_DYNASTIC_ARTICLE_EN.body,
        contentHash: REAL_DYNASTIC_ARTICLE_EN.hash,
        syncedAt: 1,
      });

      await ctx.db.insert("articleContents", {
        locale: REAL_DYNASTIC_ARTICLE_ID_LOCALE.locale,
        slug: REAL_DYNASTIC_ARTICLE_SLUG,
        category: "politics",
        articleSlug: REAL_DYNASTIC_ARTICLE_ID,
        title: REAL_DYNASTIC_ARTICLE_ID_LOCALE.title,
        description: REAL_DYNASTIC_ARTICLE_ID_LOCALE.description,
        date: REAL_DYNASTIC_ARTICLE_PUBLISHED_AT,
        body: REAL_DYNASTIC_ARTICLE_ID_LOCALE.body,
        contentHash: REAL_DYNASTIC_ARTICLE_ID_LOCALE.hash,
        syncedAt: 1,
      });

      return englishArticleId;
    });

    const localizedLookup = await t.query(async (ctx) => {
      const englishLookup = await getAudioContentLookup(ctx, {
        type: "article",
        id: englishArticleId,
      });

      expect(englishLookup).not.toBeNull();

      if (englishLookup === null) {
        return null;
      }

      return await getLocalizedAudioContentLookup(ctx, englishLookup, "id");
    });

    expect(localizedLookup).toMatchObject({
      contentHash: REAL_DYNASTIC_ARTICLE_ID_LOCALE.hash,
      locale: "id",
      ref: { type: "article", id: expect.any(String) },
      slug: REAL_DYNASTIC_ARTICLE_SLUG,
    });
  });

  it("returns reset fields with a fresh pending state", () => {
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(123_456_789);

    expect(getResetAudioFields("next-hash")).toEqual({
      contentHash: "next-hash",
      status: "pending",
      script: undefined,
      audioStorageId: undefined,
      audioDuration: undefined,
      audioSize: undefined,
      errorMessage: undefined,
      failedAt: undefined,
      generationAttempts: 0,
      updatedAt: 123_456_789,
    });

    nowSpy.mockRestore();
  });

  it("skips resetting audio rows when the hash is unchanged", async () => {
    const t = convexTest(schema, convexModules);

    const subjectId = await t.mutation(async (ctx) => {
      const subjectId = await ctx.db.insert("subjectSections", {
        topicId: await ctx.db.insert("subjectTopics", {
          category: "high-school",
          grade: "10",
          material: "mathematics",
          topic: REAL_VECTOR_ADDITION_EN.topic,
          title: REAL_VECTOR_ADDITION_EN.topicTitle,
          locale: REAL_VECTOR_ADDITION_EN.locale,
          slug: REAL_VECTOR_TOPIC_SLUG,
          sectionCount: REAL_VECTOR_TOPIC_SECTION_COUNT,
          syncedAt: 1,
        }),
        locale: REAL_VECTOR_ADDITION_EN.locale,
        slug: REAL_VECTOR_SECTION_SLUG,
        category: "high-school",
        grade: "10",
        material: "mathematics",
        topic: REAL_VECTOR_ADDITION_EN.topic,
        section: REAL_VECTOR_ADDITION_EN.section,
        title: REAL_VECTOR_ADDITION_EN.title,
        description: REAL_VECTOR_ADDITION_EN.description,
        date: REAL_VECTOR_PUBLISHED_AT,
        subject: REAL_VECTOR_ADDITION_EN.subject,
        body: REAL_VECTOR_ADDITION_EN.body,
        contentHash: REAL_VECTOR_ADDITION_EN.hash,
        syncedAt: 1,
      });

      await ctx.db.insert("contentAudios", {
        contentRef: { type: "subject", id: subjectId },
        locale: REAL_VECTOR_ADDITION_EN.locale,
        contentHash: REAL_VECTOR_ADDITION_EN.hash,
        voiceId: "voice-1",
        model: "eleven_v3",
        status: "completed",
        generationAttempts: 2,
        script: "script",
        updatedAt: 5,
      });

      return subjectId;
    });

    const updatedCount = await t.mutation(
      async (ctx) =>
        await updateContentHash(
          ctx,
          { type: "subject", id: subjectId },
          REAL_VECTOR_ADDITION_EN.hash
        )
    );

    expect(updatedCount).toBe(0);
  });

  it("resets changed audio rows even when no storage attachment exists", async () => {
    const t = convexTest(schema, convexModules);

    const { audioId, subjectId } = await t.mutation(async (ctx) => {
      const subjectId = await ctx.db.insert("subjectSections", {
        topicId: await ctx.db.insert("subjectTopics", {
          category: "high-school",
          grade: "10",
          material: "mathematics",
          topic: REAL_VECTOR_ADDITION_EN.topic,
          title: REAL_VECTOR_ADDITION_EN.topicTitle,
          locale: REAL_VECTOR_ADDITION_EN.locale,
          slug: REAL_VECTOR_TOPIC_SLUG,
          sectionCount: REAL_VECTOR_TOPIC_SECTION_COUNT,
          syncedAt: 1,
        }),
        locale: REAL_VECTOR_ADDITION_EN.locale,
        slug: REAL_VECTOR_SECTION_SLUG,
        category: "high-school",
        grade: "10",
        material: "mathematics",
        topic: REAL_VECTOR_ADDITION_EN.topic,
        section: REAL_VECTOR_ADDITION_EN.section,
        title: REAL_VECTOR_ADDITION_EN.title,
        description: REAL_VECTOR_ADDITION_EN.description,
        date: REAL_VECTOR_PUBLISHED_AT,
        subject: REAL_VECTOR_ADDITION_EN.subject,
        body: REAL_VECTOR_ADDITION_EN.body,
        contentHash: REAL_VECTOR_ADDITION_EN.hash,
        syncedAt: 1,
      });
      const audioId = await ctx.db.insert("contentAudios", {
        contentRef: { type: "subject", id: subjectId },
        locale: REAL_VECTOR_ADDITION_EN.locale,
        contentHash: "old-hash-no-storage",
        voiceId: "voice-1",
        model: "eleven_v3",
        status: "failed",
        generationAttempts: 1,
        updatedAt: 5,
      });

      return { audioId, subjectId };
    });

    const updatedCount = await t.mutation(
      async (ctx) =>
        await updateContentHash(
          ctx,
          { type: "subject", id: subjectId },
          REAL_VECTOR_ADDITION_EN.hash
        )
    );

    const audio = await t.query(
      async (ctx) => await ctx.db.get("contentAudios", audioId)
    );

    expect(updatedCount).toBe(1);
    expect(audio).toMatchObject({
      contentHash: REAL_VECTOR_ADDITION_EN.hash,
      status: "pending",
      generationAttempts: 0,
    });
  });

  it("resets changed audio rows and clears stale storage references", async () => {
    const t = convexTest(schema, convexModules);

    const { audioId, subjectId } = await t.run(async (ctx) => {
      const subjectId = await ctx.db.insert("subjectSections", {
        topicId: await ctx.db.insert("subjectTopics", {
          category: "high-school",
          grade: "10",
          material: "mathematics",
          topic: REAL_VECTOR_ADDITION_EN.topic,
          title: REAL_VECTOR_ADDITION_EN.topicTitle,
          locale: REAL_VECTOR_ADDITION_EN.locale,
          slug: REAL_VECTOR_TOPIC_SLUG,
          sectionCount: REAL_VECTOR_TOPIC_SECTION_COUNT,
          syncedAt: 1,
        }),
        locale: REAL_VECTOR_ADDITION_EN.locale,
        slug: REAL_VECTOR_SECTION_SLUG,
        category: "high-school",
        grade: "10",
        material: "mathematics",
        topic: REAL_VECTOR_ADDITION_EN.topic,
        section: REAL_VECTOR_ADDITION_EN.section,
        title: REAL_VECTOR_ADDITION_EN.title,
        description: REAL_VECTOR_ADDITION_EN.description,
        date: REAL_VECTOR_PUBLISHED_AT,
        subject: REAL_VECTOR_ADDITION_EN.subject,
        body: REAL_VECTOR_ADDITION_EN.body,
        contentHash: REAL_VECTOR_ADDITION_EN.hash,
        syncedAt: 1,
      });
      const storageId = await ctx.storage.store(
        new Blob(["stale audio bytes"], { type: "audio/wav" })
      );
      const audioId = await ctx.db.insert("contentAudios", {
        contentRef: { type: "subject", id: subjectId },
        locale: REAL_VECTOR_ADDITION_EN.locale,
        contentHash: "old-hash",
        voiceId: "voice-1",
        model: "eleven_v3",
        status: "completed",
        script: "old script",
        audioStorageId: storageId,
        audioDuration: 42,
        audioSize: 7,
        errorMessage: "old error",
        failedAt: 8,
        generationAttempts: 3,
        updatedAt: 9,
      });

      return { audioId, subjectId };
    });

    const updatedCount = await t.mutation(
      async (ctx) =>
        await updateContentHash(
          ctx,
          { type: "subject", id: subjectId },
          REAL_VECTOR_ADDITION_EN.hash
        )
    );

    const audio = await t.query(
      async (ctx) => await ctx.db.get("contentAudios", audioId)
    );

    expect(updatedCount).toBe(1);
    expect(audio).toMatchObject({
      contentHash: REAL_VECTOR_ADDITION_EN.hash,
      status: "pending",
      generationAttempts: 0,
    });
    expect(audio?.script).toBeUndefined();
    expect(audio?.audioStorageId).toBeUndefined();
    expect(audio?.audioDuration).toBeUndefined();
    expect(audio?.audioSize).toBeUndefined();
    expect(audio?.errorMessage).toBeUndefined();
    expect(audio?.failedAt).toBeUndefined();
  });
});
