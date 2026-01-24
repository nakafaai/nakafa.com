import { internal } from "@repo/backend/convex/_generated/api";
import { internalAction } from "@repo/backend/convex/_generated/server";
import { v } from "convex/values";

/**
 * Sync a batch of article content.
 * Called from CLI script.
 */
export const syncArticles = internalAction({
  args: {
    articles: v.array(
      v.object({
        locale: v.union(v.literal("en"), v.literal("id")),
        slug: v.string(),
        category: v.literal("politics"),
        articleSlug: v.string(),
        title: v.string(),
        description: v.optional(v.string()),
        date: v.number(),
        body: v.string(),
        contentHash: v.string(),
        authors: v.array(v.object({ name: v.string() })),
      })
    ),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    created: number;
    updated: number;
    unchanged: number;
  }> => {
    let created = 0;
    let updated = 0;
    let unchanged = 0;

    for (const article of args.articles) {
      const result = await ctx.runMutation(
        internal.articleContents.mutations.upsertArticleContent,
        {
          locale: article.locale,
          slug: article.slug,
          category: article.category,
          articleSlug: article.articleSlug,
          title: article.title,
          description: article.description,
          date: article.date,
          body: article.body,
          contentHash: article.contentHash,
        }
      );

      switch (result.action) {
        case "created":
          created++;
          break;
        case "updated":
          updated++;
          break;
        case "unchanged":
          unchanged++;
          break;
        default:
          break;
      }

      if (result.action !== "unchanged") {
        await ctx.runMutation(
          internal.articleContents.mutations.clearContentAuthors,
          {
            contentId: result.id,
            contentType: "article",
          }
        );

        for (let i = 0; i < article.authors.length; i++) {
          await ctx.runMutation(
            internal.articleContents.mutations.linkContentAuthor,
            {
              contentId: result.id,
              contentType: "article",
              authorName: article.authors[i].name,
              order: i,
            }
          );
        }
      }
    }

    return { created, updated, unchanged };
  },
});

/**
 * Sync a batch of subject content.
 * Called from CLI script.
 */
export const syncSubjects = internalAction({
  args: {
    subjects: v.array(
      v.object({
        locale: v.union(v.literal("en"), v.literal("id")),
        slug: v.string(),
        category: v.union(
          v.literal("elementary-school"),
          v.literal("middle-school"),
          v.literal("high-school"),
          v.literal("university")
        ),
        grade: v.union(
          v.literal("1"),
          v.literal("2"),
          v.literal("3"),
          v.literal("4"),
          v.literal("5"),
          v.literal("6"),
          v.literal("7"),
          v.literal("8"),
          v.literal("9"),
          v.literal("10"),
          v.literal("11"),
          v.literal("12"),
          v.literal("bachelor"),
          v.literal("master"),
          v.literal("phd")
        ),
        material: v.union(
          v.literal("mathematics"),
          v.literal("physics"),
          v.literal("chemistry"),
          v.literal("biology"),
          v.literal("geography"),
          v.literal("economy"),
          v.literal("history"),
          v.literal("informatics"),
          v.literal("geospatial"),
          v.literal("sociology"),
          v.literal("ai-ds"),
          v.literal("game-engineering"),
          v.literal("computer-science"),
          v.literal("technology-electro-medical"),
          v.literal("political-science"),
          v.literal("informatics-engineering"),
          v.literal("international-relations")
        ),
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
  handler: async (
    ctx,
    args
  ): Promise<{
    created: number;
    updated: number;
    unchanged: number;
  }> => {
    let created = 0;
    let updated = 0;
    let unchanged = 0;

    for (const subject of args.subjects) {
      const result = await ctx.runMutation(
        internal.subjectContents.mutations.upsertSubjectContent,
        {
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
        }
      );

      switch (result.action) {
        case "created":
          created++;
          break;
        case "updated":
          updated++;
          break;
        case "unchanged":
          unchanged++;
          break;
        default:
          break;
      }

      if (result.action !== "unchanged") {
        await ctx.runMutation(
          internal.articleContents.mutations.clearContentAuthors,
          {
            contentId: result.id,
            contentType: "subject",
          }
        );

        for (let i = 0; i < subject.authors.length; i++) {
          await ctx.runMutation(
            internal.articleContents.mutations.linkContentAuthor,
            {
              contentId: result.id,
              contentType: "subject",
              authorName: subject.authors[i].name,
              order: i,
            }
          );
        }
      }
    }

    return { created, updated, unchanged };
  },
});

/**
 * Sync a batch of exercise content.
 * Called from CLI script.
 */
export const syncExercises = internalAction({
  args: {
    exercises: v.array(
      v.object({
        locale: v.union(v.literal("en"), v.literal("id")),
        slug: v.string(),
        category: v.union(v.literal("high-school"), v.literal("middle-school")),
        type: v.union(
          v.literal("grade-9"),
          v.literal("tka"),
          v.literal("snbt")
        ),
        material: v.union(
          v.literal("mathematics"),
          v.literal("quantitative-knowledge"),
          v.literal("mathematical-reasoning"),
          v.literal("general-reasoning"),
          v.literal("indonesian-language"),
          v.literal("english-language"),
          v.literal("general-knowledge"),
          v.literal("reading-and-writing-skills")
        ),
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
  handler: async (
    ctx,
    args
  ): Promise<{
    created: number;
    updated: number;
    unchanged: number;
  }> => {
    let created = 0;
    let updated = 0;
    let unchanged = 0;

    for (const exercise of args.exercises) {
      const result = await ctx.runMutation(
        internal.exerciseContents.mutations.upsertExerciseContent,
        {
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
        }
      );

      switch (result.action) {
        case "created":
          created++;
          break;
        case "updated":
          updated++;
          break;
        case "unchanged":
          unchanged++;
          break;
        default:
          break;
      }

      if (result.action !== "unchanged") {
        await ctx.runMutation(
          internal.articleContents.mutations.clearContentAuthors,
          {
            contentId: result.id,
            contentType: "exercise",
          }
        );

        for (let i = 0; i < exercise.authors.length; i++) {
          await ctx.runMutation(
            internal.articleContents.mutations.linkContentAuthor,
            {
              contentId: result.id,
              contentType: "exercise",
              authorName: exercise.authors[i].name,
              order: i,
            }
          );
        }

        await ctx.runMutation(
          internal.exerciseContents.mutations.syncExerciseChoices,
          {
            exerciseId: result.id,
            locale: exercise.locale,
            choices: exercise.choices,
          }
        );
      }
    }

    return { created, updated, unchanged };
  },
});
