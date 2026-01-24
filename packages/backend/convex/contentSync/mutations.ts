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

export const bulkSyncExercises = internalMutation({
  args: {
    exercises: v.array(
      v.object({
        locale: localeValidator,
        slug: v.string(),
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

    for (const exercise of args.exercises) {
      const existing = await ctx.db
        .query("exerciseContents")
        .withIndex("locale_slug", (q) =>
          q.eq("locale", exercise.locale).eq("slug", exercise.slug)
        )
        .first();

      if (existing) {
        if (existing.contentHash === exercise.contentHash) {
          unchanged++;
          continue;
        }

        await ctx.db.patch(existing._id, {
          category: exercise.category,
          type: exercise.type,
          material: exercise.material,
          exerciseType: exercise.exerciseType,
          setName: exercise.setName,
          number: exercise.number,
          title: exercise.title,
          description: exercise.description,
          date: exercise.date,
          questionBody: exercise.questionBody,
          answerBody: exercise.answerBody,
          contentHash: exercise.contentHash,
          syncedAt: now,
        });

        const exerciseId = existing._id;

        const existingAuthors = await ctx.db
          .query("contentAuthors")
          .withIndex("contentId_contentType", (q) =>
            q.eq("contentId", exerciseId).eq("contentType", "exercise")
          )
          .collect();

        for (const link of existingAuthors) {
          await ctx.db.delete(link._id);
        }

        for (let i = 0; i < exercise.authors.length; i++) {
          const authorName = exercise.authors[i].name;

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
              contentId: exerciseId,
              contentType: "exercise",
              authorId: author._id,
              order: i,
            });
          }
        }

        const existingChoices = await ctx.db
          .query("exerciseChoices")
          .withIndex("exerciseId_locale", (q) =>
            q.eq("exerciseId", exerciseId).eq("locale", exercise.locale)
          )
          .collect();

        for (const choice of existingChoices) {
          await ctx.db.delete(choice._id);
        }

        for (const choice of exercise.choices) {
          await ctx.db.insert("exerciseChoices", {
            exerciseId,
            locale: exercise.locale,
            optionKey: choice.optionKey,
            label: choice.label,
            isCorrect: choice.isCorrect,
            order: choice.order,
          });
        }

        updated++;
      } else {
        const exerciseId = await ctx.db.insert("exerciseContents", {
          locale: exercise.locale,
          slug: exercise.slug,
          category: exercise.category,
          type: exercise.type,
          material: exercise.material,
          exerciseType: exercise.exerciseType,
          setName: exercise.setName,
          number: exercise.number,
          title: exercise.title,
          description: exercise.description,
          date: exercise.date,
          questionBody: exercise.questionBody,
          answerBody: exercise.answerBody,
          contentHash: exercise.contentHash,
          syncedAt: now,
        });

        for (let i = 0; i < exercise.authors.length; i++) {
          const authorName = exercise.authors[i].name;

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
              contentId: exerciseId,
              contentType: "exercise",
              authorId: author._id,
              order: i,
            });
          }
        }

        for (const choice of exercise.choices) {
          await ctx.db.insert("exerciseChoices", {
            exerciseId,
            locale: exercise.locale,
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
