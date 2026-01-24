import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { internalMutation } from "@repo/backend/convex/functions";
import {
  articleCategoryValidator,
  exercisesCategoryValidator,
  exercisesMaterialValidator,
  exercisesTypeValidator,
  gradeValidator,
  localeValidator,
  materialValidator,
  subjectCategoryValidator,
} from "@repo/backend/convex/lib/contentValidators";
import { v } from "convex/values";

function slugifyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

type ContentType = "article" | "subject" | "exercise";

type AuthorCache = Map<string, Id<"authors">>;

/**
 * Builds an author cache for a batch of content items.
 * Queries for all unique author names in parallel and caches their IDs.
 * Creates new author records for any names not found.
 */
async function buildAuthorCache(
  ctx: MutationCtx,
  allAuthorNames: string[]
): Promise<AuthorCache> {
  const cache: AuthorCache = new Map();
  const uniqueNames = [...new Set(allAuthorNames)];

  const authorLookups = await Promise.all(
    uniqueNames.map((name) =>
      ctx.db
        .query("authors")
        .withIndex("name", (q) => q.eq("name", name))
        .first()
        .then((author) => ({ name, author }))
    )
  );

  for (const { name, author } of authorLookups) {
    if (author) {
      cache.set(name, author._id);
    } else {
      const username = slugifyName(name);
      const authorId = await ctx.db.insert("authors", {
        name,
        username,
      });
      cache.set(name, authorId);
    }
  }

  return cache;
}

/**
 * Syncs content authors using a pre-built cache for efficiency.
 * Removes existing author links and creates new ones with correct ordering.
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
): Promise<void> {
  const existingLinks = await ctx.db
    .query("contentAuthors")
    .withIndex("contentId_contentType", (q) =>
      q.eq("contentId", contentId).eq("contentType", contentType)
    )
    .collect();

  for (const link of existingLinks) {
    await ctx.db.delete(link._id);
  }

  for (let i = 0; i < authors.length; i++) {
    const authorName = authors[i].name;
    const authorId = authorCache.get(authorName);

    if (authorId) {
      await ctx.db.insert("contentAuthors", {
        contentId,
        contentType,
        authorId,
        order: i,
      });
    }
  }
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
    const now = Date.now();
    let created = 0;
    let updated = 0;
    let unchanged = 0;

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
        .first();

      if (existing) {
        if (existing.contentHash === article.contentHash) {
          unchanged++;
          continue;
        }

        await ctx.db.patch(existing._id, {
          category: article.category,
          articleSlug: article.articleSlug,
          title: article.title,
          description: article.description,
          date: article.date,
          body: article.body,
          contentHash: article.contentHash,
          syncedAt: now,
        });

        await syncContentAuthorsWithCache(
          ctx,
          existing._id,
          "article",
          article.authors,
          authorCache
        );

        // Sync references: delete existing and insert new
        const existingRefs = await ctx.db
          .query("articleReferences")
          .withIndex("articleId", (q) => q.eq("articleId", existing._id))
          .collect();

        for (const ref of existingRefs) {
          await ctx.db.delete(ref._id);
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

        await syncContentAuthorsWithCache(
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
        }

        created++;
      }
    }

    return { created, updated, unchanged };
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
        .first();

      if (existing) {
        const hasChanges =
          existing.title !== topic.title ||
          existing.description !== topic.description ||
          existing.sectionCount !== topic.sectionCount;

        if (!hasChanges) {
          unchanged++;
          continue;
        }

        await ctx.db.patch(existing._id, {
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
    const now = Date.now();
    let created = 0;
    let updated = 0;
    let unchanged = 0;

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
        .first();

      if (!topicDoc) {
        console.warn(`Topic not found for section: ${section.slug}`);
        continue;
      }

      const existing = await ctx.db
        .query("subjectSections")
        .withIndex("locale_slug", (q) =>
          q.eq("locale", section.locale).eq("slug", section.slug)
        )
        .first();

      if (existing) {
        if (existing.contentHash === section.contentHash) {
          unchanged++;
          continue;
        }

        await ctx.db.patch(existing._id, {
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

        await syncContentAuthorsWithCache(
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

        await syncContentAuthorsWithCache(
          ctx,
          contentId,
          "subject",
          section.authors,
          authorCache
        );

        created++;
      }
    }

    return { created, updated, unchanged };
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
        .first();

      if (existing) {
        const hasChanges =
          existing.title !== set.title ||
          existing.description !== set.description ||
          existing.questionCount !== set.questionCount;

        if (!hasChanges) {
          unchanged++;
          continue;
        }

        await ctx.db.patch(existing._id, {
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
    const now = Date.now();
    let created = 0;
    let updated = 0;
    let unchanged = 0;

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
        .first();

      if (!set) {
        console.warn(`Set not found for question: ${question.slug}`);
        continue;
      }

      const existing = await ctx.db
        .query("exerciseQuestions")
        .withIndex("locale_slug", (q) =>
          q.eq("locale", question.locale).eq("slug", question.slug)
        )
        .first();

      if (existing) {
        if (existing.contentHash === question.contentHash) {
          unchanged++;
          continue;
        }

        await ctx.db.patch(existing._id, {
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

        await syncContentAuthorsWithCache(
          ctx,
          existing._id,
          "exercise",
          question.authors,
          authorCache
        );

        // Sync choices: delete existing and insert new
        const existingChoices = await ctx.db
          .query("exerciseChoices")
          .withIndex("questionId_locale", (q) =>
            q.eq("questionId", existing._id).eq("locale", question.locale)
          )
          .collect();

        for (const choice of existingChoices) {
          await ctx.db.delete(choice._id);
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

        await syncContentAuthorsWithCache(
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
        }

        created++;
      }
    }

    return { created, updated, unchanged };
  },
});

export const deleteStaleArticles = internalMutation({
  args: {
    articleIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    let deleted = 0;

    for (const idStr of args.articleIds) {
      const articleId = ctx.db.normalizeId("articleContents", idStr);
      if (!articleId) {
        continue;
      }

      const article = await ctx.db.get(articleId);
      if (!article) {
        continue;
      }

      const contentAuthors = await ctx.db
        .query("contentAuthors")
        .withIndex("contentId_contentType", (q) =>
          q.eq("contentId", articleId).eq("contentType", "article")
        )
        .collect();

      for (const link of contentAuthors) {
        await ctx.db.delete(link._id);
      }

      const references = await ctx.db
        .query("articleReferences")
        .withIndex("articleId", (q) => q.eq("articleId", articleId))
        .collect();

      for (const ref of references) {
        await ctx.db.delete(ref._id);
      }

      await ctx.db.delete(articleId);
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
    let deleted = 0;

    for (const idStr of args.topicIds) {
      const topicId = ctx.db.normalizeId("subjectTopics", idStr);
      if (!topicId) {
        continue;
      }

      const topic = await ctx.db.get(topicId);
      if (!topic) {
        continue;
      }

      const sections = await ctx.db
        .query("subjectSections")
        .withIndex("topicId", (q) => q.eq("topicId", topicId))
        .collect();

      for (const section of sections) {
        const contentAuthors = await ctx.db
          .query("contentAuthors")
          .withIndex("contentId_contentType", (q) =>
            q.eq("contentId", section._id).eq("contentType", "subject")
          )
          .collect();

        for (const link of contentAuthors) {
          await ctx.db.delete(link._id);
        }

        await ctx.db.delete(section._id);
      }

      await ctx.db.delete(topicId);
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
    let deleted = 0;

    for (const idStr of args.sectionIds) {
      const sectionId = ctx.db.normalizeId("subjectSections", idStr);
      if (!sectionId) {
        continue;
      }

      const section = await ctx.db.get(sectionId);
      if (!section) {
        continue;
      }

      const contentAuthors = await ctx.db
        .query("contentAuthors")
        .withIndex("contentId_contentType", (q) =>
          q.eq("contentId", sectionId).eq("contentType", "subject")
        )
        .collect();

      for (const link of contentAuthors) {
        await ctx.db.delete(link._id);
      }

      await ctx.db.delete(sectionId);
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
    let deleted = 0;

    for (const idStr of args.setIds) {
      const setId = ctx.db.normalizeId("exerciseSets", idStr);
      if (!setId) {
        continue;
      }

      const set = await ctx.db.get(setId);
      if (!set) {
        continue;
      }

      const questions = await ctx.db
        .query("exerciseQuestions")
        .withIndex("setId", (q) => q.eq("setId", setId))
        .collect();

      for (const question of questions) {
        const contentAuthors = await ctx.db
          .query("contentAuthors")
          .withIndex("contentId_contentType", (q) =>
            q.eq("contentId", question._id).eq("contentType", "exercise")
          )
          .collect();

        for (const link of contentAuthors) {
          await ctx.db.delete(link._id);
        }

        const choices = await ctx.db
          .query("exerciseChoices")
          .withIndex("questionId_locale", (q) =>
            q.eq("questionId", question._id)
          )
          .collect();

        for (const choice of choices) {
          await ctx.db.delete(choice._id);
        }

        await ctx.db.delete(question._id);
      }

      await ctx.db.delete(setId);
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
    let deleted = 0;

    for (const idStr of args.questionIds) {
      const questionId = ctx.db.normalizeId("exerciseQuestions", idStr);
      if (!questionId) {
        continue;
      }

      const question = await ctx.db.get(questionId);
      if (!question) {
        continue;
      }

      const contentAuthors = await ctx.db
        .query("contentAuthors")
        .withIndex("contentId_contentType", (q) =>
          q.eq("contentId", questionId).eq("contentType", "exercise")
        )
        .collect();

      for (const link of contentAuthors) {
        await ctx.db.delete(link._id);
      }

      const choices = await ctx.db
        .query("exerciseChoices")
        .withIndex("questionId_locale", (q) => q.eq("questionId", questionId))
        .collect();

      for (const choice of choices) {
        await ctx.db.delete(choice._id);
      }

      await ctx.db.delete(questionId);
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
    let deleted = 0;

    for (const idStr of args.authorIds) {
      const authorId = ctx.db.normalizeId("authors", idStr);
      if (!authorId) {
        continue;
      }

      const author = await ctx.db.get(authorId);
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

      await ctx.db.delete(authorId);
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
      await ctx.db.delete(link._id);
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
      await ctx.db.delete(ref._id);
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
      await ctx.db.delete(choice._id);
      deleted++;
    }

    const remaining = await ctx.db.query("exerciseChoices").first();
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
      await ctx.db.delete(question._id);
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
      await ctx.db.delete(set._id);
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
      await ctx.db.delete(section._id);
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
      await ctx.db.delete(topic._id);
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
      await ctx.db.delete(article._id);
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
      await ctx.db.delete(author._id);
      deleted++;
    }

    const remaining = await ctx.db.query("authors").first();
    return { deleted, hasMore: remaining !== null };
  },
});
