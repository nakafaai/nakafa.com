import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { updateContentHash } from "@repo/backend/convex/audioStudies/utils";
import { CONTENT_SYNC_BATCH_LIMITS } from "@repo/backend/convex/contentSync/constants";
import { internalMutation } from "@repo/backend/convex/functions";
import { getOrPublishScaleVersionForTryout } from "@repo/backend/convex/irt/scaleVersions";
import {
  articleCategoryValidator,
  type ContentType,
  exercisesCategoryValidator,
  exercisesMaterialValidator,
  exercisesTypeValidator,
  gradeValidator,
  localeValidator,
  materialValidator,
  subjectCategoryValidator,
} from "@repo/backend/convex/lib/validators/contents";
import {
  detectTryoutsForProduct,
  tryoutProductValidator,
} from "@repo/backend/convex/tryouts/products";
import type { TryoutPartKey } from "@repo/backend/convex/tryouts/schema";
import { slugify } from "@repo/backend/convex/utils/helper";
import { logger } from "@repo/backend/convex/utils/logger";
import { v } from "convex/values";
import { getAll, getManyFrom } from "convex-helpers/server/relationships";

type AuthorCache = Map<string, Id<"authors">>;

/**
 * Builds a read-only author cache by querying existing authors.
 * Authors must be pre-synced via bulkSyncAuthors before content sync.
 */
async function buildAuthorCache(
  ctx: MutationCtx,
  authorNames: string[]
): Promise<AuthorCache> {
  const cache: AuthorCache = new Map();
  const uniqueNames = [...new Set(authorNames)];

  const results = await Promise.all(
    uniqueNames.map((name) =>
      ctx.db
        .query("authors")
        .withIndex("name", (q) => q.eq("name", name))
        .unique()
        .then((author) => ({ name, author }))
    )
  );

  for (const { name, author } of results) {
    if (author) {
      cache.set(name, author._id);
    }
  }

  return cache;
}

/**
 * Pre-sync authors before content sync to avoid write conflicts.
 * Run this once before syncing articles, subjects, and exercises.
 *
 * Uses parallel reads for performance at scale, then sequential inserts
 * (Convex batches all writes in a single transaction automatically).
 */
export const bulkSyncAuthors = internalMutation({
  args: {
    authorNames: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.authorNames.length > CONTENT_SYNC_BATCH_LIMITS.authors) {
      throw new Error(
        "bulkSyncAuthors received more items than one safe batch."
      );
    }

    const uniqueNames = [...new Set(args.authorNames)];

    // Parallel reads: check which authors already exist
    const existingAuthors = await Promise.all(
      uniqueNames.map((name) =>
        ctx.db
          .query("authors")
          .withIndex("name", (q) => q.eq("name", name))
          .unique()
          .then((author) => ({ name, exists: author !== null }))
      )
    );

    // Identify new authors to create
    const newAuthorNames = existingAuthors
      .filter((a) => !a.exists)
      .map((a) => a.name);

    // Sequential inserts (Convex batches these in one transaction)
    for (const name of newAuthorNames) {
      await ctx.db.insert("authors", {
        name,
        username: slugify(name),
      });
    }

    return {
      created: newAuthorNames.length,
      existing: uniqueNames.length - newAuthorNames.length,
    };
  },
});

/**
 * Syncs content authors using a pre-built cache for efficiency.
 * Removes existing author links and creates new ones with correct ordering.
 * Returns the number of author links created.
 */
async function syncContentAuthorsWithCache(
  ctx: MutationCtx,
  contentId:
    | Id<"articleContents">
    | Id<"subjectSections">
    | Id<"exerciseQuestions">,
  contentType: ContentType,
  authors: Array<{ name: string }>,
  authorCache: AuthorCache
): Promise<number> {
  const missingAuthors = authors.flatMap((author) => {
    if (authorCache.has(author.name)) {
      return [];
    }

    return [author.name];
  });

  if (missingAuthors.length > 0) {
    throw new Error(
      `[contentSync] Missing author(s) for ${contentType} ${contentId}: ${missingAuthors.join(", ")}. Run bulkSyncAuthors first.`
    );
  }

  const existingLinks = await ctx.db
    .query("contentAuthors")
    .withIndex("contentId_contentType_authorId", (q) =>
      q.eq("contentId", contentId).eq("contentType", contentType)
    )
    .collect();

  for (const link of existingLinks) {
    await ctx.db.delete("contentAuthors", link._id);
  }

  let linksCreated = 0;

  for (let i = 0; i < authors.length; i++) {
    const authorName = authors[i].name;
    const authorId = authorCache.get(authorName);

    if (!authorId) {
      throw new Error(
        `[contentSync] Missing author cache entry for ${authorName}.`
      );
    }

    await ctx.db.insert("contentAuthors", {
      contentId,
      contentType,
      authorId,
      order: i,
    });
    linksCreated++;
  }

  return linksCreated;
}

export const bulkSyncArticles = internalMutation({
  args: {
    articles: v.array(
      v.object({
        locale: localeValidator,
        slug: v.string(),
        category: articleCategoryValidator,
        articleSlug: v.string(),
        title: v.string(),
        description: v.optional(v.string()),
        date: v.number(),
        body: v.string(),
        contentHash: v.string(),
        authors: v.array(v.object({ name: v.string() })),
        references: v.array(
          v.object({
            title: v.string(),
            authors: v.string(),
            year: v.number(),
            url: v.optional(v.string()),
            citation: v.optional(v.string()),
            publication: v.optional(v.string()),
            details: v.optional(v.string()),
          })
        ),
      })
    ),
  },
  handler: async (ctx, args) => {
    if (args.articles.length > CONTENT_SYNC_BATCH_LIMITS.articles) {
      throw new Error(
        "bulkSyncArticles received more items than one safe batch."
      );
    }

    const now = Date.now();
    let created = 0;
    let updated = 0;
    let unchanged = 0;
    let referencesCreated = 0;
    let authorLinksCreated = 0;

    const allAuthorNames = args.articles.flatMap((a) =>
      a.authors.map((author) => author.name)
    );
    const authorCache = await buildAuthorCache(ctx, allAuthorNames);

    for (const article of args.articles) {
      const existing = await ctx.db
        .query("articleContents")
        .withIndex("locale_slug", (q) =>
          q.eq("locale", article.locale).eq("slug", article.slug)
        )
        .unique();

      if (existing) {
        if (existing.contentHash === article.contentHash) {
          unchanged++;
          continue;
        }

        await ctx.db.patch("articleContents", existing._id, {
          category: article.category,
          articleSlug: article.articleSlug,
          title: article.title,
          description: article.description,
          date: article.date,
          body: article.body,
          contentHash: article.contentHash,
          syncedAt: now,
        });

        // Invalidate cached audio since content changed
        await updateContentHash(
          ctx,
          { type: "article", id: existing._id },
          article.contentHash
        );

        authorLinksCreated += await syncContentAuthorsWithCache(
          ctx,
          existing._id,
          "article",
          article.authors,
          authorCache
        );

        const existingRefs = await ctx.db
          .query("articleReferences")
          .withIndex("articleId", (q) => q.eq("articleId", existing._id))
          .collect();

        for (const ref of existingRefs) {
          await ctx.db.delete("articleReferences", ref._id);
        }

        for (let i = 0; i < article.references.length; i++) {
          const ref = article.references[i];
          await ctx.db.insert("articleReferences", {
            articleId: existing._id,
            title: ref.title,
            authors: ref.authors,
            year: ref.year,
            url: ref.url,
            citation: ref.citation,
            publication: ref.publication,
            details: ref.details,
            order: i,
          });
          referencesCreated++;
        }

        updated++;
      } else {
        const articleId = await ctx.db.insert("articleContents", {
          locale: article.locale,
          slug: article.slug,
          category: article.category,
          articleSlug: article.articleSlug,
          title: article.title,
          description: article.description,
          date: article.date,
          body: article.body,
          contentHash: article.contentHash,
          syncedAt: now,
        });

        authorLinksCreated += await syncContentAuthorsWithCache(
          ctx,
          articleId,
          "article",
          article.authors,
          authorCache
        );

        for (let i = 0; i < article.references.length; i++) {
          const ref = article.references[i];
          await ctx.db.insert("articleReferences", {
            articleId,
            title: ref.title,
            authors: ref.authors,
            year: ref.year,
            url: ref.url,
            citation: ref.citation,
            publication: ref.publication,
            details: ref.details,
            order: i,
          });
          referencesCreated++;
        }

        created++;
      }
    }

    return {
      created,
      updated,
      unchanged,
      referencesCreated,
      authorLinksCreated,
    };
  },
});

export const bulkSyncSubjectTopics = internalMutation({
  args: {
    topics: v.array(
      v.object({
        locale: localeValidator,
        slug: v.string(),
        category: subjectCategoryValidator,
        grade: gradeValidator,
        material: materialValidator,
        topic: v.string(),
        title: v.string(),
        description: v.optional(v.string()),
        sectionCount: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    if (args.topics.length > CONTENT_SYNC_BATCH_LIMITS.subjectTopics) {
      throw new Error(
        "bulkSyncSubjectTopics received more items than one safe batch."
      );
    }

    const now = Date.now();
    let created = 0;
    let updated = 0;
    let unchanged = 0;

    for (const topic of args.topics) {
      const existing = await ctx.db
        .query("subjectTopics")
        .withIndex("locale_slug", (q) =>
          q.eq("locale", topic.locale).eq("slug", topic.slug)
        )
        .unique();

      if (existing) {
        const hasChanges =
          existing.title !== topic.title ||
          existing.description !== topic.description ||
          existing.sectionCount !== topic.sectionCount;

        if (!hasChanges) {
          unchanged++;
          continue;
        }

        await ctx.db.patch("subjectTopics", existing._id, {
          category: topic.category,
          grade: topic.grade,
          material: topic.material,
          topic: topic.topic,
          title: topic.title,
          description: topic.description,
          sectionCount: topic.sectionCount,
          syncedAt: now,
        });

        updated++;
      } else {
        await ctx.db.insert("subjectTopics", {
          locale: topic.locale,
          slug: topic.slug,
          category: topic.category,
          grade: topic.grade,
          material: topic.material,
          topic: topic.topic,
          title: topic.title,
          description: topic.description,
          sectionCount: topic.sectionCount,
          syncedAt: now,
        });

        created++;
      }
    }

    return { created, updated, unchanged };
  },
});

export const bulkSyncSubjectSections = internalMutation({
  args: {
    sections: v.array(
      v.object({
        locale: localeValidator,
        slug: v.string(),
        topicSlug: v.string(),
        category: subjectCategoryValidator,
        grade: gradeValidator,
        material: materialValidator,
        topic: v.string(),
        section: v.string(),
        title: v.string(),
        description: v.optional(v.string()),
        date: v.number(),
        subject: v.optional(v.string()),
        body: v.string(),
        contentHash: v.string(),
        authors: v.array(v.object({ name: v.string() })),
      })
    ),
  },
  handler: async (ctx, args) => {
    if (args.sections.length > CONTENT_SYNC_BATCH_LIMITS.subjectSections) {
      throw new Error(
        "bulkSyncSubjectSections received more items than one safe batch."
      );
    }

    const now = Date.now();
    let created = 0;
    let updated = 0;
    let unchanged = 0;
    let authorLinksCreated = 0;

    const allAuthorNames = args.sections.flatMap((s) =>
      s.authors.map((author) => author.name)
    );
    const authorCache = await buildAuthorCache(ctx, allAuthorNames);

    for (const section of args.sections) {
      const topicDoc = await ctx.db
        .query("subjectTopics")
        .withIndex("locale_slug", (q) =>
          q.eq("locale", section.locale).eq("slug", section.topicSlug)
        )
        .unique();

      if (!topicDoc) {
        logger.warn(`Topic not found for section: ${section.slug}`);
        continue;
      }

      const existing = await ctx.db
        .query("subjectSections")
        .withIndex("locale_slug", (q) =>
          q.eq("locale", section.locale).eq("slug", section.slug)
        )
        .unique();

      if (existing) {
        if (existing.contentHash === section.contentHash) {
          unchanged++;
          continue;
        }

        await ctx.db.patch("subjectSections", existing._id, {
          topicId: topicDoc._id,
          category: section.category,
          grade: section.grade,
          material: section.material,
          topic: section.topic,
          section: section.section,
          title: section.title,
          description: section.description,
          date: section.date,
          subject: section.subject,
          body: section.body,
          contentHash: section.contentHash,
          syncedAt: now,
        });

        // Invalidate cached audio since content changed
        await updateContentHash(
          ctx,
          { type: "subject", id: existing._id },
          section.contentHash
        );

        authorLinksCreated += await syncContentAuthorsWithCache(
          ctx,
          existing._id,
          "subject",
          section.authors,
          authorCache
        );

        updated++;
      } else {
        const contentId = await ctx.db.insert("subjectSections", {
          topicId: topicDoc._id,
          locale: section.locale,
          slug: section.slug,
          category: section.category,
          grade: section.grade,
          material: section.material,
          topic: section.topic,
          section: section.section,
          title: section.title,
          description: section.description,
          date: section.date,
          subject: section.subject,
          body: section.body,
          contentHash: section.contentHash,
          syncedAt: now,
        });

        authorLinksCreated += await syncContentAuthorsWithCache(
          ctx,
          contentId,
          "subject",
          section.authors,
          authorCache
        );

        created++;
      }
    }

    return { created, updated, unchanged, authorLinksCreated };
  },
});

export const bulkSyncExerciseSets = internalMutation({
  args: {
    sets: v.array(
      v.object({
        locale: localeValidator,
        slug: v.string(),
        category: exercisesCategoryValidator,
        type: exercisesTypeValidator,
        material: exercisesMaterialValidator,
        exerciseType: v.string(),
        setName: v.string(),
        title: v.string(),
        description: v.optional(v.string()),
        questionCount: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    if (args.sets.length > CONTENT_SYNC_BATCH_LIMITS.exerciseSets) {
      throw new Error(
        "bulkSyncExerciseSets received more items than one safe batch."
      );
    }

    const now = Date.now();
    let created = 0;
    let updated = 0;
    let unchanged = 0;

    for (const set of args.sets) {
      const existing = await ctx.db
        .query("exerciseSets")
        .withIndex("locale_slug", (q) =>
          q.eq("locale", set.locale).eq("slug", set.slug)
        )
        .unique();

      if (existing) {
        const hasChanges =
          existing.title !== set.title ||
          existing.description !== set.description ||
          existing.questionCount !== set.questionCount;

        if (!hasChanges) {
          unchanged++;
          continue;
        }

        await ctx.db.patch("exerciseSets", existing._id, {
          category: set.category,
          type: set.type,
          material: set.material,
          exerciseType: set.exerciseType,
          setName: set.setName,
          title: set.title,
          description: set.description,
          questionCount: set.questionCount,
          syncedAt: now,
        });

        updated++;
      } else {
        await ctx.db.insert("exerciseSets", {
          locale: set.locale,
          slug: set.slug,
          category: set.category,
          type: set.type,
          material: set.material,
          exerciseType: set.exerciseType,
          setName: set.setName,
          title: set.title,
          description: set.description,
          questionCount: set.questionCount,
          syncedAt: now,
        });

        created++;
      }
    }

    return { created, updated, unchanged };
  },
});

export const bulkSyncExerciseQuestions = internalMutation({
  args: {
    questions: v.array(
      v.object({
        locale: localeValidator,
        slug: v.string(),
        setSlug: v.string(),
        category: exercisesCategoryValidator,
        type: exercisesTypeValidator,
        material: exercisesMaterialValidator,
        exerciseType: v.string(),
        setName: v.string(),
        number: v.number(),
        title: v.string(),
        description: v.optional(v.string()),
        date: v.number(),
        questionBody: v.string(),
        answerBody: v.string(),
        contentHash: v.string(),
        authors: v.array(v.object({ name: v.string() })),
        choices: v.array(
          v.object({
            optionKey: v.string(),
            label: v.string(),
            isCorrect: v.boolean(),
            order: v.number(),
          })
        ),
      })
    ),
  },
  handler: async (ctx, args) => {
    if (args.questions.length > CONTENT_SYNC_BATCH_LIMITS.exerciseQuestions) {
      throw new Error(
        "bulkSyncExerciseQuestions received more items than one safe batch."
      );
    }

    const now = Date.now();
    let created = 0;
    let updated = 0;
    let unchanged = 0;
    let skipped = 0;
    let choicesCreated = 0;
    let authorLinksCreated = 0;
    const skippedSetSlugs = new Set<string>();

    const allAuthorNames = args.questions.flatMap((q) =>
      q.authors.map((author) => author.name)
    );
    const authorCache = await buildAuthorCache(ctx, allAuthorNames);

    for (const question of args.questions) {
      const set = await ctx.db
        .query("exerciseSets")
        .withIndex("locale_slug", (q) =>
          q.eq("locale", question.locale).eq("slug", question.setSlug)
        )
        .unique();

      if (!set) {
        skipped++;
        skippedSetSlugs.add(question.setSlug);
        logger.warn(`Set not found for question: ${question.slug}`);
        continue;
      }

      const existing = await ctx.db
        .query("exerciseQuestions")
        .withIndex("locale_slug", (q) =>
          q.eq("locale", question.locale).eq("slug", question.slug)
        )
        .unique();

      if (existing) {
        if (existing.contentHash === question.contentHash) {
          unchanged++;
          continue;
        }

        await ctx.db.patch("exerciseQuestions", existing._id, {
          setId: set._id,
          category: question.category,
          type: question.type,
          material: question.material,
          exerciseType: question.exerciseType,
          setName: question.setName,
          number: question.number,
          title: question.title,
          description: question.description,
          date: question.date,
          questionBody: question.questionBody,
          answerBody: question.answerBody,
          contentHash: question.contentHash,
          syncedAt: now,
        });

        authorLinksCreated += await syncContentAuthorsWithCache(
          ctx,
          existing._id,
          "exercise",
          question.authors,
          authorCache
        );

        const existingChoices = await ctx.db
          .query("exerciseChoices")
          .withIndex("questionId_locale", (q) =>
            q.eq("questionId", existing._id).eq("locale", question.locale)
          )
          .collect();

        for (const choice of existingChoices) {
          await ctx.db.delete("exerciseChoices", choice._id);
        }

        for (const choice of question.choices) {
          await ctx.db.insert("exerciseChoices", {
            questionId: existing._id,
            locale: question.locale,
            optionKey: choice.optionKey,
            label: choice.label,
            isCorrect: choice.isCorrect,
            order: choice.order,
          });
          choicesCreated++;
        }

        updated++;
      } else {
        const questionId = await ctx.db.insert("exerciseQuestions", {
          setId: set._id,
          locale: question.locale,
          slug: question.slug,
          category: question.category,
          type: question.type,
          material: question.material,
          exerciseType: question.exerciseType,
          setName: question.setName,
          number: question.number,
          title: question.title,
          description: question.description,
          date: question.date,
          questionBody: question.questionBody,
          answerBody: question.answerBody,
          contentHash: question.contentHash,
          syncedAt: now,
        });

        authorLinksCreated += await syncContentAuthorsWithCache(
          ctx,
          questionId,
          "exercise",
          question.authors,
          authorCache
        );

        for (const choice of question.choices) {
          await ctx.db.insert("exerciseChoices", {
            questionId,
            locale: question.locale,
            optionKey: choice.optionKey,
            label: choice.label,
            isCorrect: choice.isCorrect,
            order: choice.order,
          });
          choicesCreated++;
        }

        created++;
      }
    }

    return {
      created,
      updated,
      unchanged,
      skipped,
      skippedSetSlugs: [...skippedSetSlugs],
      choicesCreated,
      authorLinksCreated,
    };
  },
});

export const deleteStaleArticles = internalMutation({
  args: {
    articleIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.articleIds.length > CONTENT_SYNC_BATCH_LIMITS.staleArticles) {
      throw new Error(
        "deleteStaleArticles received more IDs than one safe batch."
      );
    }

    // Normalize all IDs upfront to avoid repeated normalization in loop
    const articleIds = args.articleIds
      .map((idStr) => ctx.db.normalizeId("articleContents", idStr))
      .filter((id) => id !== null);

    if (articleIds.length === 0) {
      return { deleted: 0 };
    }

    // Batch fetch all articles at once using getAll (O(1) instead of O(n))
    const articles = await getAll(ctx.db, articleIds);

    let deleted = 0;
    const validArticleIds: Id<"articleContents">[] = [];

    // Filter out null results and collect valid IDs
    for (let i = 0; i < articles.length; i++) {
      if (articles[i] !== null) {
        validArticleIds.push(articleIds[i]);
      }
    }

    // Process each article's related data
    // Note: Sequential deletes are acceptable as Convex batches writes automatically
    for (const articleId of validArticleIds) {
      const contentAuthors = await ctx.db
        .query("contentAuthors")
        .withIndex("contentId_contentType_authorId", (q) =>
          q.eq("contentId", articleId).eq("contentType", "article")
        )
        .collect();

      for (const link of contentAuthors) {
        await ctx.db.delete("contentAuthors", link._id);
      }

      const references = await ctx.db
        .query("articleReferences")
        .withIndex("articleId", (q) => q.eq("articleId", articleId))
        .collect();

      for (const ref of references) {
        await ctx.db.delete("articleReferences", ref._id);
      }

      await ctx.db.delete("articleContents", articleId);
      deleted++;
    }

    return { deleted };
  },
});

export const deleteStaleSubjectTopics = internalMutation({
  args: {
    topicIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.topicIds.length > CONTENT_SYNC_BATCH_LIMITS.staleSubjectTopics) {
      throw new Error(
        "deleteStaleSubjectTopics received more IDs than one safe batch."
      );
    }

    // Normalize all IDs upfront
    const topicIds = args.topicIds
      .map((idStr) => ctx.db.normalizeId("subjectTopics", idStr))
      .filter((id) => id !== null);

    if (topicIds.length === 0) {
      return { deleted: 0 };
    }

    // Batch fetch all topics at once using getAll
    const topics = await getAll(ctx.db, topicIds);

    let deleted = 0;
    const validTopicIds: Id<"subjectTopics">[] = [];

    // Filter out null results
    for (let i = 0; i < topics.length; i++) {
      if (topics[i] !== null) {
        validTopicIds.push(topicIds[i]);
      }
    }

    // Process each topic
    for (const topicId of validTopicIds) {
      const sections = await ctx.db
        .query("subjectSections")
        .withIndex("topicId", (q) => q.eq("topicId", topicId))
        .collect();

      for (const section of sections) {
        const contentAuthors = await ctx.db
          .query("contentAuthors")
          .withIndex("contentId_contentType_authorId", (q) =>
            q.eq("contentId", section._id).eq("contentType", "subject")
          )
          .collect();

        for (const link of contentAuthors) {
          await ctx.db.delete("contentAuthors", link._id);
        }

        await ctx.db.delete("subjectSections", section._id);
      }

      await ctx.db.delete("subjectTopics", topicId);
      deleted++;
    }

    return { deleted };
  },
});

export const deleteStaleSubjectSections = internalMutation({
  args: {
    sectionIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    if (
      args.sectionIds.length > CONTENT_SYNC_BATCH_LIMITS.staleSubjectSections
    ) {
      throw new Error(
        "deleteStaleSubjectSections received more IDs than one safe batch."
      );
    }

    // Normalize all IDs upfront
    const sectionIds = args.sectionIds
      .map((idStr) => ctx.db.normalizeId("subjectSections", idStr))
      .filter((id) => id !== null);

    if (sectionIds.length === 0) {
      return { deleted: 0 };
    }

    // Batch fetch all sections at once using getAll
    const sections = await getAll(ctx.db, sectionIds);

    let deleted = 0;
    const validSectionIds: Id<"subjectSections">[] = [];

    // Filter out null results
    for (let i = 0; i < sections.length; i++) {
      if (sections[i] !== null) {
        validSectionIds.push(sectionIds[i]);
      }
    }

    // Process each section
    for (const sectionId of validSectionIds) {
      const contentAuthors = await ctx.db
        .query("contentAuthors")
        .withIndex("contentId_contentType_authorId", (q) =>
          q.eq("contentId", sectionId).eq("contentType", "subject")
        )
        .collect();

      for (const link of contentAuthors) {
        await ctx.db.delete("contentAuthors", link._id);
      }

      await ctx.db.delete("subjectSections", sectionId);
      deleted++;
    }

    return { deleted };
  },
});

export const deleteStaleExerciseSets = internalMutation({
  args: {
    setIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.setIds.length > CONTENT_SYNC_BATCH_LIMITS.staleExerciseSets) {
      throw new Error(
        "deleteStaleExerciseSets received more IDs than one safe batch."
      );
    }

    // Normalize all IDs upfront
    const setIds = args.setIds
      .map((idStr) => ctx.db.normalizeId("exerciseSets", idStr))
      .filter((id) => id !== null);

    if (setIds.length === 0) {
      return { deleted: 0 };
    }

    // Batch fetch all exercise sets at once using getAll
    const sets = await getAll(ctx.db, setIds);

    let deleted = 0;
    const validSetIds: Id<"exerciseSets">[] = [];

    // Filter out null results
    for (let i = 0; i < sets.length; i++) {
      if (sets[i] !== null) {
        validSetIds.push(setIds[i]);
      }
    }

    // Process each exercise set
    for (const setId of validSetIds) {
      const questions = await ctx.db
        .query("exerciseQuestions")
        .withIndex("setId", (q) => q.eq("setId", setId))
        .collect();

      for (const question of questions) {
        const contentAuthors = await ctx.db
          .query("contentAuthors")
          .withIndex("contentId_contentType_authorId", (q) =>
            q.eq("contentId", question._id).eq("contentType", "exercise")
          )
          .collect();

        for (const link of contentAuthors) {
          await ctx.db.delete("contentAuthors", link._id);
        }

        const choices = await ctx.db
          .query("exerciseChoices")
          .withIndex("questionId_locale", (q) =>
            q.eq("questionId", question._id)
          )
          .collect();

        for (const choice of choices) {
          await ctx.db.delete("exerciseChoices", choice._id);
        }

        await ctx.db.delete("exerciseQuestions", question._id);
      }

      await ctx.db.delete("exerciseSets", setId);
      deleted++;
    }

    return { deleted };
  },
});

export const deleteStaleExerciseQuestions = internalMutation({
  args: {
    questionIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    if (
      args.questionIds.length > CONTENT_SYNC_BATCH_LIMITS.staleExerciseQuestions
    ) {
      throw new Error(
        "deleteStaleExerciseQuestions received more IDs than one safe batch."
      );
    }

    // Normalize all IDs upfront
    const questionIds = args.questionIds
      .map((idStr) => ctx.db.normalizeId("exerciseQuestions", idStr))
      .filter((id) => id !== null);

    if (questionIds.length === 0) {
      return { deleted: 0 };
    }

    // Batch fetch all questions at once using getAll
    const questions = await getAll(ctx.db, questionIds);

    let deleted = 0;
    const validQuestionIds: Id<"exerciseQuestions">[] = [];

    // Filter out null results
    for (let i = 0; i < questions.length; i++) {
      if (questions[i] !== null) {
        validQuestionIds.push(questionIds[i]);
      }
    }

    // Process each question
    for (const questionId of validQuestionIds) {
      const contentAuthors = await ctx.db
        .query("contentAuthors")
        .withIndex("contentId_contentType_authorId", (q) =>
          q.eq("contentId", questionId).eq("contentType", "exercise")
        )
        .collect();

      for (const link of contentAuthors) {
        await ctx.db.delete("contentAuthors", link._id);
      }

      const choices = await ctx.db
        .query("exerciseChoices")
        .withIndex("questionId_locale", (q) => q.eq("questionId", questionId))
        .collect();

      for (const choice of choices) {
        await ctx.db.delete("exerciseChoices", choice._id);
      }

      await ctx.db.delete("exerciseQuestions", questionId);
      deleted++;
    }

    return { deleted };
  },
});

export const deleteUnusedAuthors = internalMutation({
  args: {
    authorIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.authorIds.length > CONTENT_SYNC_BATCH_LIMITS.unusedAuthors) {
      throw new Error(
        "deleteUnusedAuthors received more IDs than one safe batch."
      );
    }

    // Normalize all IDs upfront
    const authorIds = args.authorIds
      .map((idStr) => ctx.db.normalizeId("authors", idStr))
      .filter((id) => id !== null);

    if (authorIds.length === 0) {
      return { deleted: 0 };
    }

    // Batch fetch all authors at once using getAll
    const authors = await getAll(ctx.db, authorIds);

    let deleted = 0;

    // Process each author
    for (let i = 0; i < authors.length; i++) {
      const author = authors[i];
      const authorId = authorIds[i];

      if (!author) {
        continue;
      }

      const linkedContent = await ctx.db
        .query("contentAuthors")
        .withIndex("authorId", (q) => q.eq("authorId", authorId))
        .first();

      if (linkedContent) {
        continue;
      }

      await ctx.db.delete("authors", authorId);
      deleted++;
    }

    return { deleted };
  },
});

/**
 * Batch size for delete operations.
 * Keep small to stay within Convex mutation time limits (1 second).
 */
const DELETE_BATCH_SIZE = 500;

/**
 * Delete a batch of content authors (join table).
 * Returns remaining count for pagination.
 */
export const deleteContentAuthorsBatch = internalMutation({
  args: {},
  handler: async (ctx) => {
    const contentAuthors = await ctx.db
      .query("contentAuthors")
      .take(DELETE_BATCH_SIZE);
    let deleted = 0;

    for (const link of contentAuthors) {
      await ctx.db.delete("contentAuthors", link._id);
      deleted++;
    }

    const remaining = await ctx.db.query("contentAuthors").first();
    return { deleted, hasMore: remaining !== null };
  },
});

/**
 * Delete a batch of article references.
 */
export const deleteArticleReferencesBatch = internalMutation({
  args: {},
  handler: async (ctx) => {
    const references = await ctx.db
      .query("articleReferences")
      .take(DELETE_BATCH_SIZE);
    let deleted = 0;

    for (const ref of references) {
      await ctx.db.delete("articleReferences", ref._id);
      deleted++;
    }

    const remaining = await ctx.db.query("articleReferences").first();
    return { deleted, hasMore: remaining !== null };
  },
});

/**
 * Delete a batch of exercise choices.
 */
export const deleteExerciseChoicesBatch = internalMutation({
  args: {},
  handler: async (ctx) => {
    const choices = await ctx.db
      .query("exerciseChoices")
      .take(DELETE_BATCH_SIZE);
    let deleted = 0;

    for (const choice of choices) {
      await ctx.db.delete("exerciseChoices", choice._id);
      deleted++;
    }

    const remaining = await ctx.db.query("exerciseChoices").first();
    return { deleted, hasMore: remaining !== null };
  },
});

/**
 * Delete a batch of exercise answers.
 */
export const deleteExerciseAnswersBatch = internalMutation({
  args: {},
  handler: async (ctx) => {
    const answers = await ctx.db
      .query("exerciseAnswers")
      .take(DELETE_BATCH_SIZE);
    let deleted = 0;

    for (const answer of answers) {
      await ctx.db.delete("exerciseAnswers", answer._id);
      deleted++;
    }

    const remaining = await ctx.db.query("exerciseAnswers").first();
    return { deleted, hasMore: remaining !== null };
  },
});

/**
 * Delete a batch of tryout part attempts.
 */
export const deleteTryoutPartAttemptsBatch = internalMutation({
  args: {},
  handler: async (ctx) => {
    const partAttempts = await ctx.db
      .query("tryoutPartAttempts")
      .take(DELETE_BATCH_SIZE);
    let deleted = 0;

    for (const partAttempt of partAttempts) {
      await ctx.db.delete("tryoutPartAttempts", partAttempt._id);
      deleted++;
    }

    const remaining = await ctx.db.query("tryoutPartAttempts").first();
    return { deleted, hasMore: remaining !== null };
  },
});

/**
 * Delete a batch of tryout leaderboard entries.
 */
export const deleteTryoutLeaderboardEntriesBatch = internalMutation({
  args: {},
  handler: async (ctx) => {
    const entries = await ctx.db
      .query("tryoutLeaderboardEntries")
      .take(DELETE_BATCH_SIZE);
    let deleted = 0;

    for (const entry of entries) {
      await ctx.db.delete("tryoutLeaderboardEntries", entry._id);
      deleted++;
    }

    const remaining = await ctx.db.query("tryoutLeaderboardEntries").first();
    return { deleted, hasMore: remaining !== null };
  },
});

/**
 * Delete a batch of user tryout stats.
 */
export const deleteUserTryoutStatsBatch = internalMutation({
  args: {},
  handler: async (ctx) => {
    const statsRecords = await ctx.db
      .query("userTryoutStats")
      .take(DELETE_BATCH_SIZE);
    let deleted = 0;

    for (const statsRecord of statsRecords) {
      await ctx.db.delete("userTryoutStats", statsRecord._id);
      deleted++;
    }

    const remaining = await ctx.db.query("userTryoutStats").first();
    return { deleted, hasMore: remaining !== null };
  },
});

/**
 * Delete a batch of IRT scale publication queue jobs.
 */
export const deleteIrtScalePublicationQueueBatch = internalMutation({
  args: {},
  handler: async (ctx) => {
    const jobs = await ctx.db
      .query("irtScalePublicationQueue")
      .take(DELETE_BATCH_SIZE);
    let deleted = 0;

    for (const job of jobs) {
      await ctx.db.delete("irtScalePublicationQueue", job._id);
      deleted++;
    }

    const remaining = await ctx.db.query("irtScalePublicationQueue").first();
    return { deleted, hasMore: remaining !== null };
  },
});

/**
 * Delete a batch of IRT scale version items.
 */
export const deleteIrtScaleVersionItemsBatch = internalMutation({
  args: {},
  handler: async (ctx) => {
    const items = await ctx.db
      .query("irtScaleVersionItems")
      .take(DELETE_BATCH_SIZE);
    let deleted = 0;

    for (const item of items) {
      await ctx.db.delete("irtScaleVersionItems", item._id);
      deleted++;
    }

    const remaining = await ctx.db.query("irtScaleVersionItems").first();
    return { deleted, hasMore: remaining !== null };
  },
});

/**
 * Delete a batch of exercise item parameters.
 */
export const deleteExerciseItemParametersBatch = internalMutation({
  args: {},
  handler: async (ctx) => {
    const itemParameters = await ctx.db
      .query("exerciseItemParameters")
      .take(DELETE_BATCH_SIZE);
    let deleted = 0;

    for (const itemParameter of itemParameters) {
      await ctx.db.delete("exerciseItemParameters", itemParameter._id);
      deleted++;
    }

    const remaining = await ctx.db.query("exerciseItemParameters").first();
    return { deleted, hasMore: remaining !== null };
  },
});

/**
 * Delete a batch of IRT calibration queue jobs.
 */
export const deleteIrtCalibrationQueueBatch = internalMutation({
  args: {},
  handler: async (ctx) => {
    const jobs = await ctx.db
      .query("irtCalibrationQueue")
      .take(DELETE_BATCH_SIZE);
    let deleted = 0;

    for (const job of jobs) {
      await ctx.db.delete("irtCalibrationQueue", job._id);
      deleted++;
    }

    const remaining = await ctx.db.query("irtCalibrationQueue").first();
    return { deleted, hasMore: remaining !== null };
  },
});

/**
 * Delete a batch of denormalized IRT calibration attempts.
 */
export const deleteIrtCalibrationAttemptsBatch = internalMutation({
  args: {},
  handler: async (ctx) => {
    const responses = await ctx.db
      .query("irtCalibrationAttempts")
      .take(DELETE_BATCH_SIZE);
    let deleted = 0;

    for (const response of responses) {
      await ctx.db.delete("irtCalibrationAttempts", response._id);
      deleted++;
    }

    const remaining = await ctx.db.query("irtCalibrationAttempts").first();
    return { deleted, hasMore: remaining !== null };
  },
});

/**
 * Delete a batch of exercise attempts.
 */
export const deleteExerciseAttemptsBatch = internalMutation({
  args: {},
  handler: async (ctx) => {
    const attempts = await ctx.db
      .query("exerciseAttempts")
      .take(DELETE_BATCH_SIZE);
    let deleted = 0;

    for (const attempt of attempts) {
      await ctx.db.delete("exerciseAttempts", attempt._id);
      deleted++;
    }

    const remaining = await ctx.db.query("exerciseAttempts").first();
    return { deleted, hasMore: remaining !== null };
  },
});

/**
 * Delete a batch of tryout attempts.
 */
export const deleteTryoutAttemptsBatch = internalMutation({
  args: {},
  handler: async (ctx) => {
    const attempts = await ctx.db
      .query("tryoutAttempts")
      .take(DELETE_BATCH_SIZE);
    let deleted = 0;

    for (const attempt of attempts) {
      await ctx.db.delete("tryoutAttempts", attempt._id);
      deleted++;
    }

    const remaining = await ctx.db.query("tryoutAttempts").first();
    return { deleted, hasMore: remaining !== null };
  },
});

/**
 * Delete a batch of tryout part mappings.
 */
export const deleteTryoutPartSetsBatch = internalMutation({
  args: {},
  handler: async (ctx) => {
    const partSets = await ctx.db
      .query("tryoutPartSets")
      .take(DELETE_BATCH_SIZE);
    let deleted = 0;

    for (const partSet of partSets) {
      await ctx.db.delete("tryoutPartSets", partSet._id);
      deleted++;
    }

    const remaining = await ctx.db.query("tryoutPartSets").first();
    return { deleted, hasMore: remaining !== null };
  },
});

/**
 * Delete a batch of IRT scale versions.
 */
export const deleteIrtScaleVersionsBatch = internalMutation({
  args: {},
  handler: async (ctx) => {
    const versions = await ctx.db
      .query("irtScaleVersions")
      .take(DELETE_BATCH_SIZE);
    let deleted = 0;

    for (const version of versions) {
      await ctx.db.delete("irtScaleVersions", version._id);
      deleted++;
    }

    const remaining = await ctx.db.query("irtScaleVersions").first();
    return { deleted, hasMore: remaining !== null };
  },
});

/**
 * Delete a batch of IRT calibration runs.
 */
export const deleteIrtCalibrationRunsBatch = internalMutation({
  args: {},
  handler: async (ctx) => {
    const runs = await ctx.db
      .query("irtCalibrationRuns")
      .take(DELETE_BATCH_SIZE);
    let deleted = 0;

    for (const run of runs) {
      await ctx.db.delete("irtCalibrationRuns", run._id);
      deleted++;
    }

    const remaining = await ctx.db.query("irtCalibrationRuns").first();
    return { deleted, hasMore: remaining !== null };
  },
});

/**
 * Delete a batch of tryouts.
 */
export const deleteTryoutsBatch = internalMutation({
  args: {},
  handler: async (ctx) => {
    const tryouts = await ctx.db.query("tryouts").take(DELETE_BATCH_SIZE);
    let deleted = 0;

    for (const tryout of tryouts) {
      await ctx.db.delete("tryouts", tryout._id);
      deleted++;
    }

    const remaining = await ctx.db.query("tryouts").first();
    return { deleted, hasMore: remaining !== null };
  },
});

/**
 * Delete a batch of exercise questions.
 */
export const deleteExerciseQuestionsBatch = internalMutation({
  args: {},
  handler: async (ctx) => {
    const questions = await ctx.db
      .query("exerciseQuestions")
      .take(DELETE_BATCH_SIZE);
    let deleted = 0;

    for (const question of questions) {
      await ctx.db.delete("exerciseQuestions", question._id);
      deleted++;
    }

    const remaining = await ctx.db.query("exerciseQuestions").first();
    return { deleted, hasMore: remaining !== null };
  },
});

/**
 * Delete a batch of exercise sets.
 */
export const deleteExerciseSetsBatch = internalMutation({
  args: {},
  handler: async (ctx) => {
    const sets = await ctx.db.query("exerciseSets").take(DELETE_BATCH_SIZE);
    let deleted = 0;

    for (const set of sets) {
      await ctx.db.delete("exerciseSets", set._id);
      deleted++;
    }

    const remaining = await ctx.db.query("exerciseSets").first();
    return { deleted, hasMore: remaining !== null };
  },
});

/**
 * Delete a batch of subject sections.
 */
export const deleteSubjectSectionsBatch = internalMutation({
  args: {},
  handler: async (ctx) => {
    const sections = await ctx.db
      .query("subjectSections")
      .take(DELETE_BATCH_SIZE);
    let deleted = 0;

    for (const section of sections) {
      await ctx.db.delete("subjectSections", section._id);
      deleted++;
    }

    const remaining = await ctx.db.query("subjectSections").first();
    return { deleted, hasMore: remaining !== null };
  },
});

/**
 * Delete a batch of subject topics.
 */
export const deleteSubjectTopicsBatch = internalMutation({
  args: {},
  handler: async (ctx) => {
    const topics = await ctx.db.query("subjectTopics").take(DELETE_BATCH_SIZE);
    let deleted = 0;

    for (const topic of topics) {
      await ctx.db.delete("subjectTopics", topic._id);
      deleted++;
    }

    const remaining = await ctx.db.query("subjectTopics").first();
    return { deleted, hasMore: remaining !== null };
  },
});

/**
 * Delete a batch of article contents.
 */
export const deleteArticlesBatch = internalMutation({
  args: {},
  handler: async (ctx) => {
    const articles = await ctx.db
      .query("articleContents")
      .take(DELETE_BATCH_SIZE);
    let deleted = 0;

    for (const article of articles) {
      await ctx.db.delete("articleContents", article._id);
      deleted++;
    }

    const remaining = await ctx.db.query("articleContents").first();
    return { deleted, hasMore: remaining !== null };
  },
});

/**
 * Delete a batch of authors.
 */
export const deleteAuthorsBatch = internalMutation({
  args: {},
  handler: async (ctx) => {
    const authors = await ctx.db.query("authors").take(DELETE_BATCH_SIZE);
    let deleted = 0;

    for (const author of authors) {
      await ctx.db.delete("authors", author._id);
      deleted++;
    }

    const remaining = await ctx.db.query("authors").first();
    return { deleted, hasMore: remaining !== null };
  },
});

async function syncTryoutPartSetMappings(
  ctx: MutationCtx,
  {
    parts,
    tryoutId,
  }: {
    parts: Array<{
      partKey: TryoutPartKey;
      setId: Id<"exerciseSets">;
    }>;
    tryoutId: Id<"tryouts">;
  }
) {
  const existingMappings = await getManyFrom(
    ctx.db,
    "tryoutPartSets",
    "tryoutId_partIndex",
    tryoutId,
    "tryoutId"
  );
  const hasChanges =
    existingMappings.length !== parts.length ||
    existingMappings.some(
      (mapping) =>
        parts[mapping.partIndex]?.setId !== mapping.setId ||
        parts[mapping.partIndex]?.partKey !== mapping.partKey
    );

  if (!hasChanges) {
    return false;
  }

  for (const existingMapping of existingMappings) {
    await ctx.db.delete("tryoutPartSets", existingMapping._id);
  }

  for (const [partIndex, part] of parts.entries()) {
    await ctx.db.insert("tryoutPartSets", {
      tryoutId,
      setId: part.setId,
      partIndex,
      partKey: part.partKey,
    });
  }

  return true;
}

export const bulkSyncTryouts = internalMutation({
  args: {
    product: tryoutProductValidator,
    locale: localeValidator,
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    let created = 0;
    let updated = 0;
    let unchanged = 0;

    const localeSets = await ctx.db
      .query("exerciseSets")
      .withIndex("locale_slug", (q) => q.eq("locale", args.locale))
      .collect();
    const detectedTryouts = detectTryoutsForProduct({
      product: args.product,
      locale: args.locale,
      sets: localeSets,
    });

    const detectedSlugs = new Set(detectedTryouts.map((tryout) => tryout.slug));

    for (const tryout of detectedTryouts) {
      const existing = await ctx.db
        .query("tryouts")
        .withIndex("product_locale_cycleKey_slug", (q) =>
          q
            .eq("product", tryout.product)
            .eq("locale", tryout.locale)
            .eq("cycleKey", tryout.cycleKey)
            .eq("slug", tryout.slug)
        )
        .unique();

      if (existing) {
        const mappingsChanged = await syncTryoutPartSetMappings(ctx, {
          parts: tryout.parts,
          tryoutId: existing._id,
        });
        const hasChanges =
          !existing.isActive ||
          existing.partCount !== tryout.partCount ||
          existing.totalQuestionCount !== tryout.totalQuestionCount ||
          existing.label !== tryout.label ||
          mappingsChanged;

        if (!hasChanges) {
          if (existing.isActive) {
            await getOrPublishScaleVersionForTryout(ctx.db, {
              now,
              tryoutId: existing._id,
            });
          }

          unchanged++;
          continue;
        }

        await ctx.db.patch("tryouts", existing._id, {
          label: tryout.label,
          partCount: tryout.partCount,
          totalQuestionCount: tryout.totalQuestionCount,
          isActive: true,
          syncedAt: now,
        });

        if (tryout.isActive) {
          await getOrPublishScaleVersionForTryout(ctx.db, {
            now,
            tryoutId: existing._id,
          });
        }

        updated++;
      } else {
        const tryoutId = await ctx.db.insert("tryouts", {
          product: tryout.product,
          locale: tryout.locale,
          cycleKey: tryout.cycleKey,
          slug: tryout.slug,
          label: tryout.label,
          partCount: tryout.partCount,
          totalQuestionCount: tryout.totalQuestionCount,
          isActive: tryout.isActive,
          detectedAt: now,
          syncedAt: now,
        });

        await syncTryoutPartSetMappings(ctx, {
          parts: tryout.parts,
          tryoutId,
        });

        if (tryout.isActive) {
          await getOrPublishScaleVersionForTryout(ctx.db, {
            now,
            tryoutId,
          });
        }

        created++;
      }
    }

    const existingTryouts = await ctx.db
      .query("tryouts")
      .withIndex("product_locale_isActive", (q) =>
        q
          .eq("product", args.product)
          .eq("locale", args.locale)
          .eq("isActive", true)
      )
      .collect();

    for (const tryout of existingTryouts) {
      if (detectedSlugs.has(tryout.slug)) {
        continue;
      }

      await ctx.db.patch("tryouts", tryout._id, {
        isActive: false,
        syncedAt: now,
      });
      updated++;
    }

    return { created, updated, unchanged };
  },
});
