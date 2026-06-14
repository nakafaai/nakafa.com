import { internal } from "@repo/backend/convex/_generated/api";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  MAX_AUDIO_QUEUE_POPULAR_ITEMS_PER_TYPE,
  MIN_VIEW_THRESHOLD,
} from "@repo/backend/convex/audioStudies/constants";
import type { Locale } from "@repo/backend/convex/lib/validators/contents";
import schema from "@repo/backend/convex/schema";
import { getTestAudioContent } from "@repo/backend/convex/test.helpers";
import { convexModules } from "@repo/backend/convex/test.setup";
import { createLearningGraphIdentityFromRoute } from "@repo/contents/_types/learning-graph";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

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
const audioRouteKinds = [
  "article",
  "subject-section",
] as const satisfies readonly Doc<"contentRoutes">["kind"][];

type AudioRouteKind = (typeof audioRouteKinds)[number];

function getGraph(locale: Locale, route: string) {
  const graph = createLearningGraphIdentityFromRoute({ locale, route });

  if (!graph) {
    throw new Error(`Expected graph identity for ${locale}/${route}.`);
  }

  return {
    ...graph,
    content_id: graph.assetId,
  };
}

async function insertContentRoute(
  ctx: MutationCtx,
  input: {
    readonly locale: Locale;
    readonly route: string;
    readonly kind: AudioRouteKind;
    readonly title: string;
  }
) {
  const graph = getGraph(input.locale, input.route);

  await ctx.db.insert("contentRoutes", {
    ...graph,
    authors: [],
    contentHash: `route-${input.locale}-${input.route}`,
    kind: input.kind,
    locale: input.locale,
    markdown: true,
    route: input.route,
    section: input.kind === "article" ? "articles" : "subject",
    syncedAt: 1,
    title: input.title,
  });

  return graph;
}

describe("contents/queries/audio", () => {
  it("returns one ranked item per slug with source lookup metadata", async () => {
    const t = convexTest(schema, convexModules);

    await t.mutation(async (ctx) => {
      await ctx.db.insert("articleContents", {
        locale: "en",
        slug: REAL_DYNASTIC_ARTICLE_SLUG,
        category: "politics",
        articleSlug: REAL_DYNASTIC_ARTICLE_ID,
        title:
          "Framing Dynastic Politics in Local Elections within Asian Values",
        description:
          "Power is passed down under the guise of practicing asian values.",
        date: REAL_DYNASTIC_ARTICLE_PUBLISHED_AT,
        body: "Article body",
        contentHash: "article-en-hash",
        syncedAt: 1,
      });

      await ctx.db.insert("subjectSections", {
        topicId: await ctx.db.insert("subjectTopics", {
          category: "high-school",
          grade: "10",
          material: "mathematics",
          order: 0,
          topic: "vector-operations",
          title: "Vector and Operations",
          locale: "en",
          slug: REAL_VECTOR_TOPIC_SLUG,
          sectionCount: REAL_VECTOR_TOPIC_SECTION_COUNT,
          syncedAt: 1,
        }),
        locale: "en",
        slug: REAL_VECTOR_SECTION_SLUG,
        category: "high-school",
        grade: "10",
        material: "mathematics",
        order: 0,
        topic: "vector-operations",
        section: "vector-addition",
        title: "Vector Addition",
        description: "English vector addition",
        date: REAL_VECTOR_PUBLISHED_AT,
        subject: "Vector and Operations",
        body: "English subject body",
        contentHash: "subject-en-hash",
        syncedAt: 1,
      });

      await ctx.db.insert("subjectSections", {
        topicId: await ctx.db.insert("subjectTopics", {
          category: "high-school",
          grade: "10",
          material: "mathematics",
          order: 0,
          topic: "vector-operations",
          title: "Vektor dan Operasinya",
          locale: "id",
          slug: REAL_VECTOR_TOPIC_SLUG,
          sectionCount: REAL_VECTOR_TOPIC_SECTION_COUNT,
          syncedAt: 1,
        }),
        locale: "id",
        slug: REAL_VECTOR_SECTION_SLUG,
        category: "high-school",
        grade: "10",
        material: "mathematics",
        order: 0,
        topic: "vector-operations",
        section: "vector-addition",
        title: "Penjumlahan Vektor",
        description: "Indonesian vector addition",
        date: REAL_VECTOR_PUBLISHED_AT,
        subject: "Vektor dan Operasinya",
        body: "Indonesian subject body",
        contentHash: "subject-id-hash",
        syncedAt: 1,
      });

      await ctx.db.insert("audioContentSources", {
        ...getTestAudioContent({
          contentHash: "source-article-en-hash",
          locale: "en",
          route: REAL_DYNASTIC_ARTICLE_SLUG,
        }),
        syncedAt: 2,
      });
      await ctx.db.insert("audioContentSources", {
        ...getTestAudioContent({
          contentHash: "source-subject-en-hash",
          locale: "en",
          route: REAL_VECTOR_SECTION_SLUG,
        }),
        syncedAt: 2,
      });
      await ctx.db.insert("audioContentSources", {
        ...getTestAudioContent({
          contentHash: "source-subject-id-hash",
          locale: "id",
          route: REAL_VECTOR_SECTION_SLUG,
        }),
        syncedAt: 2,
      });

      const articleGraph = await insertContentRoute(ctx, {
        kind: "article",
        locale: "en",
        route: REAL_DYNASTIC_ARTICLE_SLUG,
        title: "Dynastic Politics",
      });
      const englishSubjectGraph = await insertContentRoute(ctx, {
        kind: "subject-section",
        locale: "en",
        route: REAL_VECTOR_SECTION_SLUG,
        title: "Vector Addition",
      });
      const indonesianSubjectGraph = await insertContentRoute(ctx, {
        kind: "subject-section",
        locale: "id",
        route: REAL_VECTOR_SECTION_SLUG,
        title: "Penjumlahan Vektor",
      });

      await ctx.db.insert("learningPopularity", {
        ...articleGraph,
        locale: "en",
        section: "articles",
        updatedAt: 1,
        viewCount: 80,
      });
      await ctx.db.insert("learningPopularity", {
        ...englishSubjectGraph,
        locale: "en",
        section: "subject",
        updatedAt: 1,
        viewCount: 40,
      });
      await ctx.db.insert("learningPopularity", {
        ...indonesianSubjectGraph,
        locale: "id",
        section: "subject",
        updatedAt: 1,
        viewCount: 25,
      });
    });

    const result = await t.query(
      internal.contents.queries.audio.getPopularContentForAudioQueue,
      {}
    );

    expect(result).toEqual([
      {
        sourceContent: expect.objectContaining({
          contentHash: "source-article-en-hash",
          content_id: getGraph("en", REAL_DYNASTIC_ARTICLE_SLUG).content_id,
          contentType: "article",
          locale: "en",
          route: REAL_DYNASTIC_ARTICLE_SLUG,
        }),
        viewCount: 80,
      },
      {
        sourceContent: expect.objectContaining({
          contentHash: "source-subject-en-hash",
          content_id: getGraph("en", REAL_VECTOR_SECTION_SLUG).content_id,
          contentType: "subject",
          locale: "en",
          route: REAL_VECTOR_SECTION_SLUG,
        }),
        viewCount: 40,
      },
    ]);
  });

  it("skips popularity rows whose route catalog projection is missing", async () => {
    const t = convexTest(schema, convexModules);

    await t.mutation(async (ctx) => {
      await ctx.db.insert("articleContents", {
        locale: "en",
        slug: REAL_DYNASTIC_ARTICLE_SLUG,
        category: "politics",
        articleSlug: REAL_DYNASTIC_ARTICLE_ID,
        title:
          "Framing Dynastic Politics in Local Elections within Asian Values",
        description:
          "Power is passed down under the guise of practicing asian values.",
        date: REAL_DYNASTIC_ARTICLE_PUBLISHED_AT,
        body: "Article body",
        contentHash: "article-en-hash",
        syncedAt: 1,
      });

      const articleGraph = getGraph("en", REAL_DYNASTIC_ARTICLE_SLUG);
      await ctx.db.insert("learningPopularity", {
        ...articleGraph,
        locale: "en",
        section: "articles",
        updatedAt: 1,
        viewCount: 80,
      });
      await ctx.db.insert("subjectSections", {
        topicId: await ctx.db.insert("subjectTopics", {
          category: "high-school",
          grade: "10",
          material: "mathematics",
          order: 0,
          topic: "vector-operations",
          title: "Vector and Operations",
          locale: "en",
          slug: REAL_VECTOR_TOPIC_SLUG,
          sectionCount: REAL_VECTOR_TOPIC_SECTION_COUNT,
          syncedAt: 1,
        }),
        locale: "en",
        slug: REAL_VECTOR_SECTION_SLUG,
        category: "high-school",
        grade: "10",
        material: "mathematics",
        order: 0,
        topic: "vector-operations",
        section: "vector-addition",
        title: "Vector Addition",
        description: "English vector addition",
        date: REAL_VECTOR_PUBLISHED_AT,
        subject: "Vector and Operations",
        body: "English subject body",
        contentHash: "subject-en-hash",
        syncedAt: 1,
      });

      const subjectGraph = getGraph("en", REAL_VECTOR_SECTION_SLUG);
      await ctx.db.insert("learningPopularity", {
        ...subjectGraph,
        locale: "en",
        section: "subject",
        updatedAt: 1,
        viewCount: 40,
      });
    });

    const result = await t.query(
      internal.contents.queries.audio.getPopularContentForAudioQueue,
      {}
    );

    expect(result).toEqual([]);
  });

  it("ignores popularity rows below the queue threshold before source lookup", async () => {
    const t = convexTest(schema, convexModules);

    await t.mutation(async (ctx) => {
      await ctx.db.insert("articleContents", {
        locale: "en",
        slug: REAL_DYNASTIC_ARTICLE_SLUG,
        category: "politics",
        articleSlug: REAL_DYNASTIC_ARTICLE_ID,
        title:
          "Framing Dynastic Politics in Local Elections within Asian Values",
        description:
          "Power is passed down under the guise of practicing asian values.",
        date: REAL_DYNASTIC_ARTICLE_PUBLISHED_AT,
        body: "Article body",
        contentHash: "article-en-hash",
        syncedAt: 1,
      });

      await ctx.db.insert("audioContentSources", {
        ...getTestAudioContent({
          contentHash: "source-article-en-hash",
          locale: "en",
          route: REAL_DYNASTIC_ARTICLE_SLUG,
        }),
        syncedAt: 2,
      });
      await ctx.db.insert("learningPopularity", {
        ...getGraph("en", REAL_DYNASTIC_ARTICLE_SLUG),
        locale: "en",
        section: "articles",
        updatedAt: 1,
        viewCount: MIN_VIEW_THRESHOLD - 1,
      });
    });

    const result = await t.query(
      internal.contents.queries.audio.getPopularContentForAudioQueue,
      {}
    );

    expect(result).toEqual([]);
  });

  it("bounds source lookups to the audio queue candidate window", async () => {
    const t = convexTest(schema, convexModules);

    await t.mutation(async (ctx) => {
      for (
        let index = 0;
        index < MAX_AUDIO_QUEUE_POPULAR_ITEMS_PER_TYPE + 5;
        index++
      ) {
        const slug = `articles/politics/audio-candidate-${index}`;
        await ctx.db.insert("articleContents", {
          locale: "en",
          slug,
          category: "politics",
          articleSlug: `audio-candidate-${index}`,
          title: `Audio Candidate ${index}`,
          description: "Article description",
          date: REAL_DYNASTIC_ARTICLE_PUBLISHED_AT + index,
          body: "Article body",
          contentHash: `article-${index}-hash`,
          syncedAt: 1,
        });

        await ctx.db.insert("audioContentSources", {
          ...getTestAudioContent({
            contentHash: `source-article-${index}-hash`,
            locale: "en",
            route: slug,
          }),
          syncedAt: 2,
        });
        const graph = await insertContentRoute(ctx, {
          kind: "article",
          locale: "en",
          route: slug,
          title: `Audio Candidate ${index}`,
        });
        await ctx.db.insert("learningPopularity", {
          ...graph,
          locale: "en",
          section: "articles",
          updatedAt: 1,
          viewCount: 1000 - index,
        });
      }
    });

    const result = await t.query(
      internal.contents.queries.audio.getPopularContentForAudioQueue,
      {}
    );

    expect(result).toHaveLength(MAX_AUDIO_QUEUE_POPULAR_ITEMS_PER_TYPE);
    expect(result.at(0)?.viewCount).toBe(1000);
    expect(result.at(-1)?.viewCount).toBe(
      1000 - (MAX_AUDIO_QUEUE_POPULAR_ITEMS_PER_TYPE - 1)
    );
  });
});
