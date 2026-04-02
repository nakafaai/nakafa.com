import { internal } from "@repo/backend/convex/_generated/api";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

const REAL_VECTOR_PUBLISHED_AT = 1_744_416_000_000;
const REAL_VECTOR_TOPIC_SLUG =
  "subject/high-school/10/mathematics/vector-operations";
const REAL_VECTOR_SECTION_SLUG =
  "subject/high-school/10/mathematics/vector-operations/vector-addition";
const REAL_VECTOR_TOPIC_SECTION_COUNT = 15;

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

describe("audioStudies/queries/internal", () => {
  it("returns null when script generation audio does not exist", async () => {
    const t = convexTest(schema, convexModules);

    const missingId = await t.mutation(async (ctx) => {
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
      const missingId = await ctx.db.insert("contentAudios", {
        contentRef: { type: "subject", id: subjectId },
        locale: REAL_VECTOR_ADDITION_EN.locale,
        contentHash: REAL_VECTOR_ADDITION_EN.hash,
        voiceId: "voice-1",
        model: "eleven_v3",
        status: "pending",
        generationAttempts: 0,
        updatedAt: 1,
      });

      await ctx.db.delete("contentAudios", missingId);

      return missingId;
    });

    const result = await t.query(
      internal.audioStudies.queries.internal
        .getAudioAndContentForScriptGeneration,
      { contentAudioId: missingId }
    );

    expect(result).toBeNull();
  });

  it("returns null when script generation content is missing", async () => {
    const t = convexTest(schema, convexModules);

    const audioId = await t.mutation(async (ctx) => {
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
        contentHash: REAL_VECTOR_ADDITION_EN.hash,
        voiceId: "voice-1",
        model: "eleven_v3",
        status: "pending",
        generationAttempts: 0,
        updatedAt: 1,
      });

      await ctx.db.delete("subjectSections", subjectId);

      return audioId;
    });

    const result = await t.query(
      internal.audioStudies.queries.internal
        .getAudioAndContentForScriptGeneration,
      { contentAudioId: audioId }
    );

    expect(result).toBeNull();
  });

  it("returns real audio and content data for script generation", async () => {
    const t = convexTest(schema, convexModules);

    const audioId = await t.mutation(async (ctx) => {
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

      return await ctx.db.insert("contentAudios", {
        contentRef: { type: "subject", id: subjectId },
        locale: REAL_VECTOR_ADDITION_EN.locale,
        contentHash: REAL_VECTOR_ADDITION_EN.hash,
        voiceId: "voice-1",
        voiceSettings: { stability: 0.4 },
        model: "eleven_v3",
        status: "pending",
        generationAttempts: 0,
        updatedAt: 1,
      });
    });

    const result = await t.query(
      internal.audioStudies.queries.internal
        .getAudioAndContentForScriptGeneration,
      { contentAudioId: audioId }
    );

    expect(result).toEqual({
      contentAudio: {
        contentRef: { type: "subject", id: expect.any(String) },
        contentHash: REAL_VECTOR_ADDITION_EN.hash,
        voiceId: "voice-1",
        voiceSettings: { stability: 0.4 },
        status: "pending",
      },
      content: {
        title: REAL_VECTOR_ADDITION_EN.title,
        description: REAL_VECTOR_ADDITION_EN.description,
        body: REAL_VECTOR_ADDITION_EN.body,
        locale: REAL_VECTOR_ADDITION_EN.locale,
      },
    });
  });

  it("returns null when speech generation audio has no script", async () => {
    const t = convexTest(schema, convexModules);

    const audioId = await t.mutation(async (ctx) => {
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

      return await ctx.db.insert("contentAudios", {
        contentRef: { type: "subject", id: subjectId },
        locale: REAL_VECTOR_ADDITION_EN.locale,
        contentHash: REAL_VECTOR_ADDITION_EN.hash,
        voiceId: "voice-1",
        model: "eleven_v3",
        status: "script-generated",
        generationAttempts: 0,
        updatedAt: 1,
      });
    });

    const result = await t.query(
      internal.audioStudies.queries.internal.getAudioForSpeechGeneration,
      { contentAudioId: audioId }
    );

    expect(result).toBeNull();
  });

  it("returns speech generation data when a script exists", async () => {
    const t = convexTest(schema, convexModules);

    const audioId = await t.mutation(async (ctx) => {
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

      return await ctx.db.insert("contentAudios", {
        contentRef: { type: "subject", id: subjectId },
        locale: REAL_VECTOR_ADDITION_EN.locale,
        contentHash: REAL_VECTOR_ADDITION_EN.hash,
        voiceId: "voice-1",
        voiceSettings: { style: 0.2 },
        model: "eleven_v3",
        status: "script-generated",
        script: "Narration script",
        generationAttempts: 1,
        updatedAt: 1,
      });
    });

    const result = await t.query(
      internal.audioStudies.queries.internal.getAudioForSpeechGeneration,
      { contentAudioId: audioId }
    );

    expect(result).toEqual({
      script: "Narration script",
      voiceId: "voice-1",
      voiceSettings: { style: 0.2 },
      contentHash: REAL_VECTOR_ADDITION_EN.hash,
      model: "eleven_v3",
    });
  });

  it("verifies content hashes against stored audio rows", async () => {
    const t = convexTest(schema, convexModules);

    const { audioId, missingId } = await t.mutation(async (ctx) => {
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
        contentHash: REAL_VECTOR_ADDITION_EN.hash,
        voiceId: "voice-1",
        model: "eleven_v3",
        status: "pending",
        generationAttempts: 0,
        updatedAt: 1,
      });
      const missingId = await ctx.db.insert("contentAudios", {
        contentRef: { type: "subject", id: subjectId },
        locale: "id",
        contentHash: REAL_VECTOR_ADDITION_EN.hash,
        voiceId: "voice-2",
        model: "eleven_v3",
        status: "pending",
        generationAttempts: 0,
        updatedAt: 1,
      });

      await ctx.db.delete("contentAudios", missingId);

      return { audioId, missingId };
    });

    const [missing, mismatch, match] = await Promise.all([
      t.query(internal.audioStudies.queries.internal.verifyContentHash, {
        contentAudioId: missingId,
        expectedHash: REAL_VECTOR_ADDITION_EN.hash,
      }),
      t.query(internal.audioStudies.queries.internal.verifyContentHash, {
        contentAudioId: audioId,
        expectedHash: "different-hash",
      }),
      t.query(internal.audioStudies.queries.internal.verifyContentHash, {
        contentAudioId: audioId,
        expectedHash: REAL_VECTOR_ADDITION_EN.hash,
      }),
    ]);

    expect(missing).toBe(false);
    expect(mismatch).toBe(false);
    expect(match).toBe(true);
  });

  it("returns the current content hash or null for missing content refs", async () => {
    const t = convexTest(schema, convexModules);

    const { existingId, missingId } = await t.mutation(async (ctx) => {
      const existingId = await ctx.db.insert("subjectSections", {
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
      const missingId = await ctx.db.insert("subjectSections", {
        topicId: await ctx.db.insert("subjectTopics", {
          category: "high-school",
          grade: "10",
          material: "mathematics",
          topic: REAL_VECTOR_ADDITION_EN.topic,
          title: REAL_VECTOR_ADDITION_EN.topicTitle,
          locale: REAL_VECTOR_ADDITION_EN.locale,
          slug: `${REAL_VECTOR_TOPIC_SLUG}-missing`,
          sectionCount: 1,
          syncedAt: 1,
        }),
        locale: REAL_VECTOR_ADDITION_EN.locale,
        slug: `${REAL_VECTOR_SECTION_SLUG}-missing`,
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

      await ctx.db.delete("subjectSections", missingId);

      return { existingId, missingId };
    });

    const [existingHash, missingHash] = await Promise.all([
      t.query(internal.audioStudies.queries.internal.getContentHash, {
        contentRef: { type: "subject", id: existingId },
      }),
      t.query(internal.audioStudies.queries.internal.getContentHash, {
        contentRef: { type: "subject", id: missingId },
      }),
    ]);

    expect(existingHash).toBe(REAL_VECTOR_ADDITION_EN.hash);
    expect(missingHash).toBeNull();
  });
});
