import { internal } from "@repo/backend/convex/_generated/api";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { logger } from "@repo/backend/convex/utils/logger";
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

// Sourced from packages/contents/subject/high-school/10/mathematics/vector-operations/vector-addition/en.mdx
const REAL_VECTOR_ADDITION_EN = {
  body: [
    "Vector addition differs from scalar addition.",
    "In scalar addition, we only add magnitudes without considering direction.",
    "For example, 2 kg of sugar plus 3 kg of sugar equals 5 kg of sugar.",
    "However, in vector addition, we must consider both magnitude and direction.",
  ].join(" "),
  date: "04/12/2025",
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

// Sourced from packages/contents/subject/high-school/10/mathematics/vector-operations/vector-addition/id.mdx
const REAL_VECTOR_ADDITION_ID = {
  body: [
    "Penjumlahan vektor berbeda dengan penjumlahan skalar.",
    "Pada penjumlahan skalar, kita hanya menjumlahkan besaran tanpa memperhatikan arah.",
    "Contohnya, 2 kg gula ditambah 3 kg gula menghasilkan 5 kg gula.",
    "Namun, pada penjumlahan vektor, kita harus memperhatikan besaran dan arah.",
  ].join(" "),
  date: "04/12/2025",
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

// Sourced from packages/contents/articles/politics/dynastic-politics-asian-values/en.mdx
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

// Sourced from packages/contents/articles/politics/dynastic-politics-asian-values/id.mdx
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

describe("contents/mutations/audio", () => {
  beforeEach(() => {
    vi.spyOn(logger, "debug").mockImplementation(() => undefined);
    vi.spyOn(logger, "info").mockImplementation(() => undefined);
    vi.spyOn(logger, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns early when there are no popularity items", async () => {
    const t = convexTest(schema, convexModules);

    const result = await t.mutation(
      internal.contents.mutations.audio.enqueuePopularContentForAudio,
      { items: [] }
    );

    expect(result).toEqual({ processed: 0, queued: 0 });
  });

  it("skips items below the minimum view threshold", async () => {
    const t = convexTest(schema, convexModules);

    const sourceId = await t.mutation(
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

    const result = await t.mutation(
      internal.contents.mutations.audio.enqueuePopularContentForAudio,
      {
        items: [{ ref: { type: "subject", id: sourceId }, viewCount: 9 }],
      }
    );

    const queuedCount = await t.query(
      async (ctx) => await ctx.db.query("audioGenerationQueue").collect()
    );

    expect(result).toEqual({ processed: 1, queued: 0 });
    expect(queuedCount).toHaveLength(0);
  });

  it("queues one item per supported locale for a subject candidate", async () => {
    const t = convexTest(schema, convexModules);

    const { sourceId } = await t.mutation(async (ctx) => {
      const sourceId = await ctx.db.insert("subjectSections", {
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

      return { sourceId };
    });

    const result = await t.mutation(
      internal.contents.mutations.audio.enqueuePopularContentForAudio,
      {
        items: [{ ref: { type: "subject", id: sourceId }, viewCount: 25 }],
      }
    );

    const queuedItems = await t.query(
      async (ctx) =>
        await ctx.db
          .query("audioGenerationQueue")
          .withIndex("by_slug_and_status", (q) =>
            q.eq("slug", REAL_VECTOR_SECTION_SLUG).eq("status", "pending")
          )
          .collect()
    );

    expect(result).toEqual({ processed: 1, queued: 2 });
    expect(queuedItems).toHaveLength(2);
    expect(queuedItems.map((item) => item.locale).sort()).toEqual(["en", "id"]);
  });

  it("uses provided source lookup metadata when queueing a subject candidate", async () => {
    const t = convexTest(schema, convexModules);

    const { englishId } = await t.mutation(async (ctx) => {
      const englishId = await ctx.db.insert("subjectSections", {
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

      return { englishId };
    });

    const result = await t.mutation(
      internal.contents.mutations.audio.enqueuePopularContentForAudio,
      {
        items: [
          {
            ref: { type: "subject", id: englishId },
            sourceContent: {
              contentHash: REAL_VECTOR_ADDITION_EN.hash,
              locale: "en",
              ref: { type: "subject", id: englishId },
              slug: REAL_VECTOR_SECTION_SLUG,
            },
            viewCount: 25,
          },
        ],
      }
    );

    const queuedItems = await t.query(
      async (ctx) =>
        await ctx.db
          .query("audioGenerationQueue")
          .withIndex("by_slug_and_status", (q) =>
            q.eq("slug", REAL_VECTOR_SECTION_SLUG).eq("status", "pending")
          )
          .collect()
    );

    expect(result).toEqual({ processed: 1, queued: 2 });
    expect(queuedItems).toHaveLength(2);
  });

  it("skips deleted source content", async () => {
    const t = convexTest(schema, convexModules);

    const deletedId = await t.mutation(async (ctx) => {
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

      await ctx.db.delete("subjectSections", subjectId);

      return subjectId;
    });

    const result = await t.mutation(
      internal.contents.mutations.audio.enqueuePopularContentForAudio,
      {
        items: [{ ref: { type: "subject", id: deletedId }, viewCount: 25 }],
      }
    );

    expect(result).toEqual({ processed: 1, queued: 0 });
  });

  it("queues only locales that exist for the content slug", async () => {
    const t = convexTest(schema, convexModules);

    const sourceId = await t.mutation(
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

    const result = await t.mutation(
      internal.contents.mutations.audio.enqueuePopularContentForAudio,
      {
        items: [{ ref: { type: "subject", id: sourceId }, viewCount: 25 }],
      }
    );

    const queuedItems = await t.query(
      async (ctx) => await ctx.db.query("audioGenerationQueue").collect()
    );

    expect(result).toEqual({ processed: 1, queued: 1 });
    expect(queuedItems).toHaveLength(1);
    expect(queuedItems[0]?.locale).toBe("en");
  });

  it("does not duplicate locale queue items that are already pending", async () => {
    const t = convexTest(schema, convexModules);

    const { englishId } = await t.mutation(async (ctx) => {
      const englishId = await ctx.db.insert("subjectSections", {
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

      await ctx.db.insert("audioGenerationQueue", {
        contentRef: { type: "subject", id: englishId },
        locale: REAL_VECTOR_ADDITION_EN.locale,
        slug: REAL_VECTOR_SECTION_SLUG,
        priorityScore: 100,
        status: "pending",
        requestedAt: 1,
        retryCount: 0,
        maxRetries: 3,
        updatedAt: 1,
      });

      return { englishId };
    });

    const result = await t.mutation(
      internal.contents.mutations.audio.enqueuePopularContentForAudio,
      {
        items: [{ ref: { type: "subject", id: englishId }, viewCount: 25 }],
      }
    );

    const queuedItems = await t.query(
      async (ctx) =>
        await ctx.db
          .query("audioGenerationQueue")
          .withIndex("by_slug_and_status", (q) =>
            q.eq("slug", REAL_VECTOR_SECTION_SLUG).eq("status", "pending")
          )
          .collect()
    );

    expect(result).toEqual({ processed: 1, queued: 1 });
    expect(queuedItems).toHaveLength(2);
    expect(queuedItems.map((item) => item.locale).sort()).toEqual(["en", "id"]);
  });

  it("sorts real popularity items before applying the threshold cutoff", async () => {
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

      return { articleId, subjectId };
    });

    const result = await t.mutation(
      internal.contents.mutations.audio.enqueuePopularContentForAudio,
      {
        items: [
          { ref: { type: "subject", id: subjectId }, viewCount: 9 },
          { ref: { type: "article", id: articleId }, viewCount: 25 },
        ],
      }
    );

    const queuedItems = await t.query(
      async (ctx) =>
        await ctx.db
          .query("audioGenerationQueue")
          .withIndex("by_slug_and_status", (q) =>
            q.eq("slug", REAL_DYNASTIC_ARTICLE_SLUG).eq("status", "pending")
          )
          .collect()
    );

    expect(result).toEqual({ processed: 2, queued: 2 });
    expect(queuedItems).toHaveLength(2);
    expect(queuedItems.map((item) => item.locale).sort()).toEqual(["en", "id"]);
  });

  it("replaces completed queue items before re-enqueuing", async () => {
    const t = convexTest(schema, convexModules);

    const { completedQueueId, englishId } = await t.mutation(async (ctx) => {
      const englishId = await ctx.db.insert("subjectSections", {
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

      const completedQueueId = await ctx.db.insert("audioGenerationQueue", {
        contentRef: { type: "subject", id: englishId },
        locale: REAL_VECTOR_ADDITION_EN.locale,
        slug: REAL_VECTOR_SECTION_SLUG,
        priorityScore: 100,
        status: "completed",
        requestedAt: 1,
        completedAt: 1,
        retryCount: 0,
        maxRetries: 3,
        updatedAt: 1,
      });

      return { completedQueueId, englishId };
    });

    const result = await t.mutation(
      internal.contents.mutations.audio.enqueuePopularContentForAudio,
      {
        items: [{ ref: { type: "subject", id: englishId }, viewCount: 25 }],
      }
    );

    const { completedQueueItem, queuedItems } = await t.query(async (ctx) => ({
      completedQueueItem: await ctx.db.get(
        "audioGenerationQueue",
        completedQueueId
      ),
      queuedItems: await ctx.db
        .query("audioGenerationQueue")
        .withIndex("by_slug_and_status", (q) =>
          q.eq("slug", REAL_VECTOR_SECTION_SLUG).eq("status", "pending")
        )
        .collect(),
    }));

    expect(result).toEqual({ processed: 1, queued: 2 });
    expect(completedQueueItem).toBeNull();
    expect(queuedItems).toHaveLength(2);
  });

  it("skips locales that already have completed audio for the current hash", async () => {
    const t = convexTest(schema, convexModules);

    const { sourceId } = await t.mutation(async (ctx) => {
      const englishTopicId = await ctx.db.insert("subjectTopics", {
        category: "high-school",
        grade: "10",
        material: "mathematics",
        topic: REAL_VECTOR_ADDITION_EN.topic,
        title: REAL_VECTOR_ADDITION_EN.topicTitle,
        locale: REAL_VECTOR_ADDITION_EN.locale,
        slug: REAL_VECTOR_TOPIC_SLUG,
        sectionCount: REAL_VECTOR_TOPIC_SECTION_COUNT,
        syncedAt: 1,
      });
      const indonesianTopicId = await ctx.db.insert("subjectTopics", {
        category: "high-school",
        grade: "10",
        material: "mathematics",
        topic: REAL_VECTOR_ADDITION_ID.topic,
        title: REAL_VECTOR_ADDITION_ID.topicTitle,
        locale: REAL_VECTOR_ADDITION_ID.locale,
        slug: REAL_VECTOR_TOPIC_SLUG,
        sectionCount: REAL_VECTOR_TOPIC_SECTION_COUNT,
        syncedAt: 1,
      });

      const sourceId = await ctx.db.insert("subjectSections", {
        topicId: englishTopicId,
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
      const localizedId = await ctx.db.insert("subjectSections", {
        topicId: indonesianTopicId,
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

      await ctx.db.insert("contentAudios", {
        contentRef: { type: "subject", id: localizedId },
        locale: REAL_VECTOR_ADDITION_ID.locale,
        contentHash: REAL_VECTOR_ADDITION_ID.hash,
        voiceId: "voice-1",
        model: "eleven_v3",
        status: "completed",
        generationAttempts: 1,
        updatedAt: 1,
      });

      return { sourceId };
    });

    const result = await t.mutation(
      internal.contents.mutations.audio.enqueuePopularContentForAudio,
      {
        items: [{ ref: { type: "subject", id: sourceId }, viewCount: 25 }],
      }
    );

    const queuedItems = await t.query(
      async (ctx) => await ctx.db.query("audioGenerationQueue").collect()
    );

    expect(result).toEqual({ processed: 1, queued: 1 });
    expect(queuedItems).toHaveLength(1);
    expect(queuedItems[0]?.locale).toBe(REAL_VECTOR_ADDITION_EN.locale);
    expect(queuedItems[0]?.contentRef).toEqual({
      type: "subject",
      id: sourceId,
    });
    expect(queuedItems[0]?.slug).toBe(REAL_VECTOR_SECTION_SLUG);
  });

  it("queues one item per supported locale for a real article candidate", async () => {
    const t = convexTest(schema, convexModules);

    const articleId = await t.mutation(async (ctx) => {
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

      return articleId;
    });

    const result = await t.mutation(
      internal.contents.mutations.audio.enqueuePopularContentForAudio,
      {
        items: [{ ref: { type: "article", id: articleId }, viewCount: 25 }],
      }
    );

    const queuedItems = await t.query(
      async (ctx) =>
        await ctx.db
          .query("audioGenerationQueue")
          .withIndex("by_slug_and_status", (q) =>
            q.eq("slug", REAL_DYNASTIC_ARTICLE_SLUG).eq("status", "pending")
          )
          .collect()
    );

    expect(result).toEqual({ processed: 1, queued: 2 });
    expect(queuedItems).toHaveLength(2);
    expect(queuedItems.map((item) => item.locale).sort()).toEqual(["en", "id"]);
  });
});
