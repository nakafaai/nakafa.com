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

        const articleId = existing._id;

        const existingAuthors = await ctx.db
          .query("contentAuthors")
          .withIndex("contentId_contentType", (q) =>
            q.eq("contentId", articleId).eq("contentType", "article")
          )
          .collect();

        for (const link of existingAuthors) {
          await ctx.db.delete(link._id);
        }

        for (let i = 0; i < article.authors.length; i++) {
          const authorName = article.authors[i].name;

          let author = await ctx.db
            .query("authors")
            .withIndex("name", (q) => q.eq("name", authorName))
            .first();

          if (!author) {
            const username = slugifyName(authorName);
            const authorId = await ctx.db.insert("authors", {
              name: authorName,
              username,
            });
            author = await ctx.db.get(authorId);
          }

          if (author) {
            await ctx.db.insert("contentAuthors", {
              contentId: articleId,
              contentType: "article",
              authorId: author._id,
              order: i,
            });
          }
        }

        const existingRefs = await ctx.db
          .query("articleReferences")
          .withIndex("articleId", (q) => q.eq("articleId", articleId))
          .collect();

        for (const ref of existingRefs) {
          await ctx.db.delete(ref._id);
        }

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

        for (let i = 0; i < article.authors.length; i++) {
          const authorName = article.authors[i].name;

          let author = await ctx.db
            .query("authors")
            .withIndex("name", (q) => q.eq("name", authorName))
            .first();

          if (!author) {
            const username = slugifyName(authorName);
            const newAuthorId = await ctx.db.insert("authors", {
              name: authorName,
              username,
            });
            author = await ctx.db.get(newAuthorId);
          }

          if (author) {
            await ctx.db.insert("contentAuthors", {
              contentId: articleId,
              contentType: "article",
              authorId: author._id,
              order: i,
            });
          }
        }

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

export const bulkSyncSubjects = internalMutation({
  args: {
    subjects: v.array(
      v.object({
        locale: localeValidator,
        slug: v.string(),
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

    for (const subject of args.subjects) {
      const existing = await ctx.db
        .query("subjectContents")
        .withIndex("locale_slug", (q) =>
          q.eq("locale", subject.locale).eq("slug", subject.slug)
        )
        .first();

      if (existing) {
        if (existing.contentHash === subject.contentHash) {
          unchanged++;
          continue;
        }

        await ctx.db.patch(existing._id, {
          category: subject.category,
          grade: subject.grade,
          material: subject.material,
          topic: subject.topic,
          section: subject.section,
          title: subject.title,
          description: subject.description,
          date: subject.date,
          subject: subject.subject,
          body: subject.body,
          contentHash: subject.contentHash,
          syncedAt: now,
        });

        const contentId = existing._id;

        const existingAuthors = await ctx.db
          .query("contentAuthors")
          .withIndex("contentId_contentType", (q) =>
            q.eq("contentId", contentId).eq("contentType", "subject")
          )
          .collect();

        for (const link of existingAuthors) {
          await ctx.db.delete(link._id);
        }

        for (let i = 0; i < subject.authors.length; i++) {
          const authorName = subject.authors[i].name;

          let author = await ctx.db
            .query("authors")
            .withIndex("name", (q) => q.eq("name", authorName))
            .first();

          if (!author) {
            const username = slugifyName(authorName);
            const authorId = await ctx.db.insert("authors", {
              name: authorName,
              username,
            });
            author = await ctx.db.get(authorId);
          }

          if (author) {
            await ctx.db.insert("contentAuthors", {
              contentId,
              contentType: "subject",
              authorId: author._id,
              order: i,
            });
          }
        }

        updated++;
      } else {
        const contentId = await ctx.db.insert("subjectContents", {
          locale: subject.locale,
          slug: subject.slug,
          category: subject.category,
          grade: subject.grade,
          material: subject.material,
          topic: subject.topic,
          section: subject.section,
          title: subject.title,
          description: subject.description,
          date: subject.date,
          subject: subject.subject,
          body: subject.body,
          contentHash: subject.contentHash,
          syncedAt: now,
        });

        for (let i = 0; i < subject.authors.length; i++) {
          const authorName = subject.authors[i].name;

          let author = await ctx.db
            .query("authors")
            .withIndex("name", (q) => q.eq("name", authorName))
            .first();

          if (!author) {
            const username = slugifyName(authorName);
            const newAuthorId = await ctx.db.insert("authors", {
              name: authorName,
              username,
            });
            author = await ctx.db.get(newAuthorId);
          }

          if (author) {
            await ctx.db.insert("contentAuthors", {
              contentId,
              contentType: "subject",
              authorId: author._id,
              order: i,
            });
          }
        }

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

        const questionId = existing._id;

        const existingAuthors = await ctx.db
          .query("contentAuthors")
          .withIndex("contentId_contentType", (q) =>
            q.eq("contentId", questionId).eq("contentType", "exercise")
          )
          .collect();

        for (const link of existingAuthors) {
          await ctx.db.delete(link._id);
        }

        for (let i = 0; i < question.authors.length; i++) {
          const authorName = question.authors[i].name;

          let author = await ctx.db
            .query("authors")
            .withIndex("name", (q) => q.eq("name", authorName))
            .first();

          if (!author) {
            const username = slugifyName(authorName);
            const authorId = await ctx.db.insert("authors", {
              name: authorName,
              username,
            });
            author = await ctx.db.get(authorId);
          }

          if (author) {
            await ctx.db.insert("contentAuthors", {
              contentId: questionId,
              contentType: "exercise",
              authorId: author._id,
              order: i,
            });
          }
        }

        const existingChoices = await ctx.db
          .query("exerciseChoices")
          .withIndex("questionId_locale", (q) =>
            q.eq("questionId", questionId).eq("locale", question.locale)
          )
          .collect();

        for (const choice of existingChoices) {
          await ctx.db.delete(choice._id);
        }

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

        for (let i = 0; i < question.authors.length; i++) {
          const authorName = question.authors[i].name;

          let author = await ctx.db
            .query("authors")
            .withIndex("name", (q) => q.eq("name", authorName))
            .first();

          if (!author) {
            const username = slugifyName(authorName);
            const newAuthorId = await ctx.db.insert("authors", {
              name: authorName,
              username,
            });
            author = await ctx.db.get(newAuthorId);
          }

          if (author) {
            await ctx.db.insert("contentAuthors", {
              contentId: questionId,
              contentType: "exercise",
              authorId: author._id,
              order: i,
            });
          }
        }

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

export const deleteStaleSubjects = internalMutation({
  args: {
    subjectIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    let deleted = 0;

    for (const idStr of args.subjectIds) {
      const subjectId = ctx.db.normalizeId("subjectContents", idStr);
      if (!subjectId) {
        continue;
      }

      const subject = await ctx.db.get(subjectId);
      if (!subject) {
        continue;
      }

      const contentAuthors = await ctx.db
        .query("contentAuthors")
        .withIndex("contentId_contentType", (q) =>
          q.eq("contentId", subjectId).eq("contentType", "subject")
        )
        .collect();

      for (const link of contentAuthors) {
        await ctx.db.delete(link._id);
      }

      await ctx.db.delete(subjectId);
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
